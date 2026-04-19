#!/usr/bin/env bash
# =============================================================================
# CA Guardian — Emergency Rollback Script
#
# Usage:
#   ./scripts/rollback.sh [staging|production] [revision-number]
#
# Examples:
#   ./scripts/rollback.sh production           # Roll back to previous release
#   ./scripts/rollback.sh production 3         # Roll back to specific Helm revision
#   ./scripts/rollback.sh staging              # Roll back staging
# =============================================================================

set -euo pipefail

ENVIRONMENT="${1:-production}"
REVISION="${2:-0}"   # 0 = previous revision

if [[ "$ENVIRONMENT" == "production" ]]; then
  NAMESPACE="ca-guardian"
  KUBECONFIG_SECRET="PRODUCTION_KUBECONFIG"
else
  NAMESPACE="ca-guardian-staging"
  KUBECONFIG_SECRET="STAGING_KUBECONFIG"
fi

RELEASE_NAME="ca-guardian"

echo "========================================"
echo "  CA Guardian — Emergency Rollback"
echo "  Environment : $ENVIRONMENT"
echo "  Namespace   : $NAMESPACE"
echo "  To revision : ${REVISION:-previous}"
echo "========================================"
echo ""

# Safety gate for production
if [[ "$ENVIRONMENT" == "production" ]]; then
  echo "⚠️  WARNING: You are about to roll back PRODUCTION."
  read -rp "Type 'rollback-production' to confirm: " CONFIRM
  if [[ "$CONFIRM" != "rollback-production" ]]; then
    echo "Aborted."
    exit 1
  fi
fi

# Show current state
echo ""
echo "Current Helm releases:"
helm list -n "$NAMESPACE"

echo ""
echo "Release history:"
helm history "$RELEASE_NAME" -n "$NAMESPACE" --max 10

echo ""
if [[ "$REVISION" == "0" ]]; then
  echo "Rolling back to previous revision..."
  helm rollback "$RELEASE_NAME" -n "$NAMESPACE" --wait --timeout 10m
else
  echo "Rolling back to revision $REVISION..."
  helm rollback "$RELEASE_NAME" "$REVISION" -n "$NAMESPACE" --wait --timeout 10m
fi

echo ""
echo "Post-rollback state:"
helm list -n "$NAMESPACE"

echo ""
echo "Pod status:"
kubectl -n "$NAMESPACE" get pods -l "app.kubernetes.io/name=ca-guardian"

echo ""
echo "✅ Rollback complete."
echo ""
echo "⚠️  Remember to:"
echo "  1. Revert the image tag in helm/ca-guardian/values-${ENVIRONMENT}.yaml"
echo "  2. Commit and push the revert so ArgoCD stays in sync"
echo "  3. Investigate root cause before re-deploying"
