# CA Guardian — GitOps & CI/CD Guide

## Overview

CA Guardian uses a **GitOps** model where Git is the single source of truth for all deployments. No one runs `kubectl apply` or `helm upgrade` manually in production — everything flows through Git commits and pull requests.

```
Developer                 GitHub                    Kubernetes
    │                        │                           │
    │── Push to develop ───▶ │── CI (lint/test/build) ─▶│
    │                        │── Update staging tag ───▶ │
    │                        │                           │── ArgoCD auto-sync
    │                        │                           │── Deploy to staging
    │                        │                           │
    │── Create PR to main ──▶│── CI runs again          │
    │── 2 approvals ────────▶│── Merge                  │
    │                        │── Tag release ──────────▶ │
    │                        │── CD creates release      │
    │                        │── Deploy to staging ────▶ │
    │                        │── Smoke tests pass        │
    │                        │── Manual gate ────────────│── ArgoCD manual sync
    │                        │                           │── Deploy to production
```

---

## Branch Strategy

| Branch | Purpose | Protection | Auto-deploy |
|---|---|---|---|
| `main` | Production-ready code | 2 approvals, all checks | No — manual ArgoCD sync |
| `develop` | Integration branch | 1 approval, all checks | Yes → staging |
| `feature/*` | Feature work | None | No |
| `hotfix/*` | Emergency fixes | 1 approval | Yes → staging, then prod |
| `release/*` | Release prep | 1 approval | No |

### Hotfix flow
```bash
git checkout -b hotfix/fix-graph-api-timeout main
# ... make fix ...
git push origin hotfix/fix-graph-api-timeout
# Open PR → main AND develop
# After merge: tag is created automatically
```

---

## GitHub Actions Workflows

### `ci.yml` — Runs on every push and PR
1. **Lint** — TypeScript type-check + ESLint on both backend and frontend
2. **Test Backend** — Jest tests against a real PostgreSQL (via service container)
3. **Test Frontend** — Vitest component tests
4. **Security** — Trivy filesystem scan + npm audit + secret detection (Gitleaks)
5. **Build** — Multi-arch Docker images pushed to GHCR with immutable SHA tags
6. **Update manifests** — Bumps image tag in `values-staging.yaml` or `values-production.yaml`

### `cd.yml` — Runs on version tags (`v*.*.*`)
1. **Create Release** — Generates changelog, creates GitHub Release with release notes
2. **Deploy Staging** — Helm upgrade with `--atomic` (auto-rollback on failure) + smoke tests
3. **Manual gate** — GitHub Environment protection requires approval
4. **Deploy Production** — Same Helm upgrade, pre-deploy DB backup, smoke tests, auto-rollback on failure

### `release.yml` — Manual workflow to create version tags
```
GitHub Actions → Actions tab → "Release — Create Tag" → Run workflow
  bump: patch | minor | major | rc
```

### `security.yml` — Weekly + on every PR
- CodeQL static analysis
- Gitleaks secret detection
- SBOM generation (SPDX format)

### `backup.yml` — Daily at 02:00 UTC
- Automated `pg_dump` from the production cluster
- Upload to configured cloud storage

---

## ArgoCD Setup

### Architecture
```
ArgoCD (in-cluster)
├── Project: ca-guardian
│   ├── Application: ca-guardian-staging   (auto-sync, tracks 'develop')
│   └── Application: ca-guardian-production (manual sync, tracks 'main')
```

### Bootstrap (first time only)
```bash
./scripts/bootstrap-argocd.sh my-k8s-context
```

### Day-to-day operations

**View app status:**
```bash
argocd app get ca-guardian-staging
argocd app get ca-guardian-production
```

**Manually sync production:**
```bash
argocd app sync ca-guardian-production --prune
# Or in the ArgoCD UI: click "Sync" on ca-guardian-production
```

**Force refresh (re-read Git without waiting):**
```bash
argocd app get ca-guardian-production --refresh
```

**Roll back production to previous version in ArgoCD:**
```bash
argocd app rollback ca-guardian-production
# Or use emergency script:
./scripts/rollback.sh production
```

### Sync Windows
Production syncs are **blocked** Mon-Fri after 20:00 UTC and all day Sat-Sun.
To deploy outside these windows, a platform admin must temporarily disable the sync window:
```bash
argocd proj windows disable-manual-sync ca-guardian
```

---

## Secrets Management

### Local / Docker Compose
Copy `.env.example` to `.env` and fill in values.

### Kubernetes (quick start)
```bash
./scripts/create-secrets.sh staging
./scripts/create-secrets.sh production
```

### Kubernetes (production — recommended)
Use **External Secrets Operator** with Azure Key Vault:
```bash
# Install ESO
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets \
  -n external-secrets --create-namespace

# Apply ExternalSecret manifests
kubectl apply -f k8s/base/external-secret.yaml
```
Store all secrets in Azure Key Vault under the names defined in `k8s/base/external-secret.yaml`.

### Required GitHub Actions Secrets

| Secret | Description |
|---|---|
| `STAGING_KUBECONFIG` | Base64-encoded kubeconfig for staging cluster |
| `PRODUCTION_KUBECONFIG` | Base64-encoded kubeconfig for production cluster |
| `SLACK_WEBHOOK_URL` | Slack incoming webhook for deploy notifications |

To encode a kubeconfig:
```bash
cat ~/.kube/staging-config | base64 -w 0
```

---

## Docker Images

All images are published to GitHub Container Registry (GHCR):

```
ghcr.io/your-org/ca-guardian/backend:v1.2.3
ghcr.io/your-org/ca-guardian/backend:sha-abc1234
ghcr.io/your-org/ca-guardian/backend:latest

ghcr.io/your-org/ca-guardian/frontend:v1.2.3
ghcr.io/your-org/ca-guardian/frontend:sha-abc1234
ghcr.io/your-org/ca-guardian/frontend:latest
```

Images are built for `linux/amd64` and `linux/arm64`.

### Pull images locally
```bash
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_USERNAME --password-stdin
docker pull ghcr.io/your-org/ca-guardian/backend:latest
```

---

## Helm Chart Reference

```bash
# Lint chart
helm lint helm/ca-guardian -f helm/ca-guardian/values.yaml -f helm/ca-guardian/values-production.yaml

# Dry-run render
helm template ca-guardian helm/ca-guardian \
  -f helm/ca-guardian/values.yaml \
  -f helm/ca-guardian/values-production.yaml \
  --namespace ca-guardian

# Install manually (for testing only — production uses ArgoCD)
helm upgrade --install ca-guardian helm/ca-guardian \
  -f helm/ca-guardian/values.yaml \
  -f helm/ca-guardian/values-staging.yaml \
  --namespace ca-guardian-staging \
  --create-namespace \
  --wait
```

---

## Versioning

CA Guardian follows **Semantic Versioning** (`MAJOR.MINOR.PATCH`):

- `PATCH` — Bug fixes, security patches, dependency updates
- `MINOR` — New features, backwards-compatible changes
- `MAJOR` — Breaking changes (API changes, DB migrations requiring manual steps)

### Creating a release
```
GitHub → Actions → "Release — Create Tag" → Run workflow
  Select: patch / minor / major / rc
```

This will:
1. Bump version in `package.json` files
2. Create and push a git tag (e.g. `v1.3.0`)
3. Trigger the CD pipeline automatically

---

## Monitoring & Observability

The backend exposes Prometheus metrics at `/metrics` (configure via Helm `podAnnotations`).

Recommended stack:
- **Prometheus** + **Grafana** for metrics
- **Loki** for log aggregation (backend writes structured JSON logs)
- **AlertManager** for paging

Pod annotations for auto-scraping are already set in `values.yaml`:
```yaml
prometheus.io/scrape: "true"
prometheus.io/port: "3001"
prometheus.io/path: "/metrics"
```

---

## Repository Configuration

Run once after creating the GitHub repo:
```bash
gh auth login
./scripts/configure-github.sh your-org/ca-guardian
```

This sets up:
- Branch protection rules for `main` (2 approvals, linear history, all checks required)
- Branch protection for `develop` (1 approval)
- Squash-merge only
- Auto-delete branches on merge
- Deployment environments with protection rules
- Issue labels
- CODEOWNERS file
