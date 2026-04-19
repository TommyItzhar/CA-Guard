#!/usr/bin/env bash
# =============================================================================
# CA Guardian — Configure GitHub Repository Settings
#
# Requires: GitHub CLI (gh) authenticated with repo admin access
# Usage:    ./scripts/configure-github.sh your-org/ca-guardian
# =============================================================================

set -euo pipefail

REPO="${1:-your-org/ca-guardian}"

echo "Configuring GitHub repository: $REPO"
echo ""

# ─── Branch protection — main ──────────────────────────────────────────────
echo "Setting up branch protection for 'main'..."
gh api "repos/$REPO/branches/main/protection" \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["Lint & Type-check","Backend Tests","Frontend Tests","Security Scan","Build Images"]}' \
  --field enforce_admins=false \
  --field required_pull_request_reviews='{"required_approving_review_count":2,"dismiss_stale_reviews":true,"require_code_owner_reviews":true,"require_last_push_approval":true}' \
  --field restrictions=null \
  --field allow_force_pushes=false \
  --field allow_deletions=false \
  --field required_conversation_resolution=true \
  --field required_linear_history=true

# ─── Branch protection — develop ──────────────────────────────────────────
echo "Setting up branch protection for 'develop'..."
gh api "repos/$REPO/branches/develop/protection" \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["Lint & Type-check","Backend Tests","Frontend Tests"]}' \
  --field enforce_admins=false \
  --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true}' \
  --field restrictions=null \
  --field allow_force_pushes=false \
  --field allow_deletions=false \
  --field required_conversation_resolution=true

# ─── Repository settings ──────────────────────────────────────────────────
echo "Configuring repository settings..."
gh api "repos/$REPO" \
  --method PATCH \
  --field delete_branch_on_merge=true \
  --field allow_squash_merge=true \
  --field allow_merge_commit=false \
  --field allow_rebase_merge=false \
  --field squash_merge_commit_title=PR_TITLE \
  --field squash_merge_commit_message=COMMIT_MESSAGES \
  --field allow_auto_merge=false \
  --field has_wiki=false \
  --field has_projects=true

# ─── Required environments ────────────────────────────────────────────────
echo "Creating deployment environments..."

# Staging: auto-deploy, no reviewers
gh api "repos/$REPO/environments/staging" --method PUT \
  --field wait_timer=0 \
  --field prevent_self_review=false

# Production: require 2 reviewers, 5-min wait
gh api "repos/$REPO/environments/production" --method PUT \
  --field wait_timer=5 \
  --field prevent_self_review=true \
  --field reviewers='[{"type":"Team","id":1}]' 2>/dev/null || \
  echo "  ⚠️  Could not set production reviewers — set manually in GitHub Settings > Environments > production"

# ─── Labels ───────────────────────────────────────────────────────────────
echo "Creating issue labels..."

declare -A LABELS=(
  ["bug"]="#E53E3E"
  ["enhancement"]="#38A169"
  ["dependencies"]="#805AD5"
  ["security"]="#C53030"
  ["backend"]="#3182CE"
  ["frontend"]="#D69E2E"
  ["docker"]="#2B6CB0"
  ["github-actions"]="#6B46C1"
  ["triage"]="#A0AEC0"
  ["breaking-change"]="#9B2335"
  ["documentation"]="#4299E1"
  ["good first issue"]="#68D391"
)

for label in "${!LABELS[@]}"; do
  gh label create "$label" --color "${LABELS[$label]}" --repo "$REPO" 2>/dev/null || \
    gh label edit "$label" --color "${LABELS[$label]}" --repo "$REPO" 2>/dev/null || true
done

# ─── CODEOWNERS ───────────────────────────────────────────────────────────
cat > .github/CODEOWNERS << 'EOF'
# Default owners for everything
*                           @your-org/ca-guardian-team

# Backend
/backend/                   @your-org/backend-team @your-org/ca-guardian-team

# Frontend
/frontend/                  @your-org/frontend-team @your-org/ca-guardian-team

# Infrastructure & CI/CD — requires devops review
/.github/                   @your-org/devops
/helm/                      @your-org/devops
/k8s/                       @your-org/devops
/docker-compose*.yml        @your-org/devops

# Database — requires DBA review
/database/                  @your-org/dba @your-org/devops

# Security-sensitive files
/.github/workflows/security.yml  @your-org/security @your-org/devops
/backend/src/middleware/auth.ts  @your-org/security @your-org/backend-team
EOF

git add .github/CODEOWNERS
git commit -m "chore: add CODEOWNERS" --allow-empty
git push origin main

echo ""
echo "✅ GitHub repository configured successfully!"
echo ""
echo "Next steps:"
echo "  1. Add secrets in Settings > Secrets and variables > Actions:"
echo "     STAGING_KUBECONFIG, PRODUCTION_KUBECONFIG,"
echo "     SLACK_WEBHOOK_URL"
echo "  2. Invite team members and assign them to the ca-guardian-team"
echo "  3. Enable Dependabot security alerts in Settings > Security"
