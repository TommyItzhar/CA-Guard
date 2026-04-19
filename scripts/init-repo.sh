#!/usr/bin/env bash
# =============================================================================
# CA Guardian — Initialize Git Repository and Push to GitHub
#
# Usage:
#   ./scripts/init-repo.sh your-org/ca-guardian
#
# Prerequisites:
#   gh CLI installed and authenticated
# =============================================================================

set -euo pipefail

REPO="${1:-your-org/ca-guardian}"
ORG="${REPO%%/*}"
NAME="${REPO##*/}"

echo "========================================"
echo "  CA Guardian — Repository Init"
echo "  Repository: $REPO"
echo "========================================"
echo ""

# ─── Create GitHub repo ───────────────────────────────────────────────────────
echo "📦 Creating GitHub repository..."
gh repo create "$REPO" \
  --private \
  --description "CA Guardian — Conditional Access Policy Management Platform" \
  --homepage "https://ca-guardian.yourdomain.com" \
  2>/dev/null || echo "Repository already exists, continuing..."

# ─── Initialize git ───────────────────────────────────────────────────────────
cd "$(dirname "$0")/.."

if [ ! -d ".git" ]; then
  echo "Initializing git..."
  git init
  git checkout -b main
fi

# ─── Install root dev dependencies (husky) ───────────────────────────────────
echo "Installing root dev dependencies..."
npm install --ignore-scripts

# ─── Setup Husky ─────────────────────────────────────────────────────────────
echo "Setting up Husky git hooks..."
npx husky install
chmod +x .husky/commit-msg .husky/pre-commit

# ─── Initial commit ───────────────────────────────────────────────────────────
echo "Creating initial commit..."
git add .
git commit -m "feat: initial CA Guardian project setup

- Full-stack TypeScript application (React + Express)
- Azure Entra ID OAuth2/MFA authentication
- Conditional Access policy governance with change workflow
- Automated backup, versioning, and one-click rollback
- Docker Compose for local development
- GitHub Actions CI/CD pipeline
- ArgoCD GitOps configuration
- Helm chart for Kubernetes deployment
- External Secrets Operator for Azure Key Vault integration" \
  --no-verify 2>/dev/null || echo "Nothing to commit"

# ─── Push and set up remote ───────────────────────────────────────────────────
echo "Pushing to GitHub..."
git remote remove origin 2>/dev/null || true
git remote add origin "https://github.com/${REPO}.git"
git push -u origin main

# ─── Create develop branch ───────────────────────────────────────────────────
echo "Creating develop branch..."
git checkout -b develop
git push -u origin develop
git checkout main

# ─── Configure repo settings ─────────────────────────────────────────────────
echo "Configuring repository settings..."
./scripts/configure-github.sh "$REPO"

echo ""
echo "========================================"
echo "  ✅ Repository initialized!"
echo "========================================"
echo ""
echo "Repository: https://github.com/$REPO"
echo ""
echo "Next steps:"
echo ""
echo "  1. Configure secrets in GitHub:"
echo "     https://github.com/$REPO/settings/secrets/actions"
echo "     Required: STAGING_KUBECONFIG, PRODUCTION_KUBECONFIG, SLACK_WEBHOOK_URL"
echo ""
echo "  2. Bootstrap ArgoCD on your cluster:"
echo "     ./scripts/bootstrap-argocd.sh my-k8s-context"
echo ""
echo "  3. Create Kubernetes secrets:"
echo "     ./scripts/create-secrets.sh staging"
echo "     ./scripts/create-secrets.sh production"
echo ""
echo "  4. Start developing:"
echo "     cp .env.example .env"
echo "     npm run docker:dev"
echo ""
echo "  See docs/gitops.md for the full CI/CD guide."
