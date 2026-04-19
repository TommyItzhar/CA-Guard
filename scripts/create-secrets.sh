#!/usr/bin/env bash
# =============================================================================
# CA Guardian — Create Kubernetes Secrets
#
# Usage:
#   ./scripts/create-secrets.sh [staging|production]
#
# This script creates the required Kubernetes secret in the target namespace.
# In production, prefer External Secrets Operator (ESO) with Azure Key Vault
# or AWS Secrets Manager. See docs/secrets.md for details.
# =============================================================================

set -euo pipefail

ENVIRONMENT="${1:-staging}"
NAMESPACE="ca-guardian${ENVIRONMENT == 'production' ? '' : '-staging'}"

if [[ "$ENVIRONMENT" == "production" ]]; then
  NAMESPACE="ca-guardian"
else
  NAMESPACE="ca-guardian-staging"
fi

echo "Creating secrets in namespace: $NAMESPACE"
echo ""

# Prompt for each secret value
read_secret() {
  local name="$1"
  local prompt="$2"
  local value
  read -rsp "$prompt: " value
  echo ""
  echo "$value"
}

AZURE_CLIENT_ID=$(read_secret AZURE_CLIENT_ID       "Azure Client ID")
AZURE_CLIENT_SECRET=$(read_secret AZURE_CLIENT_SECRET "Azure Client Secret")
AZURE_TENANT_ID=$(read_secret AZURE_TENANT_ID       "Azure Tenant ID")
JWT_SECRET=$(read_secret JWT_SECRET                  "JWT Secret (64+ chars)")
DB_PASSWORD=$(read_secret DB_PASSWORD                "PostgreSQL password")
SESSION_SECRET=$(read_secret SESSION_SECRET          "Session secret (64+ chars)")
SMTP_PASS=$(read_secret SMTP_PASS                   "SMTP password (enter to skip)")

kubectl create secret generic ca-guardian-secrets \
  --namespace="$NAMESPACE" \
  --from-literal=AZURE_CLIENT_ID="$AZURE_CLIENT_ID" \
  --from-literal=AZURE_CLIENT_SECRET="$AZURE_CLIENT_SECRET" \
  --from-literal=AZURE_TENANT_ID="$AZURE_TENANT_ID" \
  --from-literal=JWT_SECRET="$JWT_SECRET" \
  --from-literal=DB_PASSWORD="$DB_PASSWORD" \
  --from-literal=SESSION_SECRET="$SESSION_SECRET" \
  --from-literal=SMTP_PASS="${SMTP_PASS:-}" \
  --dry-run=client -o yaml | kubectl apply -f -

echo ""
echo "✅ Secret 'ca-guardian-secrets' created/updated in namespace '$NAMESPACE'"
echo ""
echo "ℹ️  For production, consider migrating to External Secrets Operator:"
echo "   See k8s/base/external-secret.yaml for an example"
