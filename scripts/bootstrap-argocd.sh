#!/usr/bin/env bash
# =============================================================================
# CA Guardian — Bootstrap ArgoCD and Deploy Applications
#
# Usage:
#   ./scripts/bootstrap-argocd.sh [cluster-context]
#
# Prerequisites:
#   kubectl, helm, gh CLI installed and authenticated
# =============================================================================

set -euo pipefail

CONTEXT="${1:-$(kubectl config current-context)}"
ARGOCD_VERSION="v2.10.0"
ARGOCD_NAMESPACE="argocd"

echo "========================================"
echo "  CA Guardian — ArgoCD Bootstrap"
echo "  Cluster: $CONTEXT"
echo "========================================"
echo ""

kubectl config use-context "$CONTEXT"

# ─── 1. Install ArgoCD ────────────────────────────────────────────────────────
echo "📦 Installing ArgoCD ${ARGOCD_VERSION}..."

kubectl create namespace "$ARGOCD_NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

kubectl apply -n "$ARGOCD_NAMESPACE" \
  -f "https://raw.githubusercontent.com/argoproj/argo-cd/${ARGOCD_VERSION}/manifests/install.yaml"

echo "Waiting for ArgoCD to be ready..."
kubectl -n "$ARGOCD_NAMESPACE" rollout status deploy/argocd-server --timeout=300s
kubectl -n "$ARGOCD_NAMESPACE" rollout status deploy/argocd-repo-server --timeout=120s
kubectl -n "$ARGOCD_NAMESPACE" rollout status deploy/argocd-application-controller --timeout=120s

# ─── 2. Configure ArgoCD ─────────────────────────────────────────────────────
echo ""
echo "⚙️  Configuring ArgoCD..."

# Disable default admin password requirement after setup
kubectl -n "$ARGOCD_NAMESPACE" patch configmap argocd-cm \
  --type merge \
  -p '{"data":{"admin.enabled":"true","accounts.github-actions":"apiKey"}}'

# Configure RBAC
kubectl -n "$ARGOCD_NAMESPACE" patch configmap argocd-rbac-cm \
  --type merge \
  -p '{
    "data": {
      "policy.default": "role:readonly",
      "policy.csv": "g, your-org:admins, role:admin\ng, your-org:devops, role:admin\ng, your-org:developers, role:readonly"
    }
  }'

# ─── 3. Install ArgoCD Notifications ─────────────────────────────────────────
echo ""
echo "🔔 Installing ArgoCD Notifications..."
kubectl apply -n "$ARGOCD_NAMESPACE" \
  -f "https://raw.githubusercontent.com/argoproj-labs/argocd-notifications/stable/manifests/install.yaml"

kubectl apply -n "$ARGOCD_NAMESPACE" -f k8s/argocd/notifications.yaml

# ─── 4. Apply ArgoCD Project and Applications ────────────────────────────────
echo ""
echo "📋 Creating ArgoCD Project..."
kubectl apply -f k8s/argocd/project.yaml

echo "📋 Creating namespaces..."
kubectl apply -f k8s/base/namespaces.yaml

echo ""
echo "🚀 Registering ArgoCD Applications..."
kubectl apply -f k8s/argocd/application-staging.yaml
kubectl apply -f k8s/argocd/application-production.yaml

# ─── 5. Get admin credentials ────────────────────────────────────────────────
echo ""
echo "========================================"
echo "  ArgoCD Bootstrap Complete!"
echo "========================================"
echo ""

ARGOCD_PASSWORD=$(kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d 2>/dev/null || echo "Secret not found")

echo "ArgoCD initial admin password: ${ARGOCD_PASSWORD}"
echo ""
echo "Access ArgoCD UI:"
echo "  kubectl port-forward svc/argocd-server -n argocd 8080:443"
echo "  Open: https://localhost:8080"
echo "  User: admin"
echo "  Pass: (shown above)"
echo ""
echo "Next steps:"
echo "  1. Change the admin password immediately"
echo "  2. Connect your GitHub repo in ArgoCD Settings > Repositories"
echo "     URL: https://github.com/your-org/ca-guardian"
echo "  3. Create secrets: ./scripts/create-secrets.sh staging"
echo "  4. Create secrets: ./scripts/create-secrets.sh production"
echo "  5. Manually sync ca-guardian-staging in the ArgoCD UI"
echo "  6. Verify staging deployment, then sync ca-guardian-production"
