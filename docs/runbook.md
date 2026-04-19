# CA Guardian — Operations Runbook

## Incident Response

### P0 — Production down

1. Check pod status:
   ```bash
   kubectl -n ca-guardian get pods
   kubectl -n ca-guardian describe pod <pod-name>
   kubectl -n ca-guardian logs deploy/ca-guardian-backend --previous
   ```

2. If recent deploy is the cause → emergency rollback:
   ```bash
   ./scripts/rollback.sh production
   ```

3. If DB is the issue:
   ```bash
   kubectl -n ca-guardian exec deploy/ca-guardian-backend -- \
     node -e "require('./dist/utils/db').query('SELECT 1').then(console.log)"
   ```

4. Notify in Slack: `#ca-guardian-incidents`

---

### Policy sync failure

Symptom: Policies not updating, `sync_status = 'error'` in DB

1. Check backend logs for Graph API errors:
   ```bash
   kubectl -n ca-guardian logs deploy/ca-guardian-backend | grep "graphService\|Graph API"
   ```

2. Verify Azure App Registration permissions haven't expired:
   - Azure Portal → Entra ID → App registrations → CA Guardian → API permissions
   - Ensure admin consent is still granted

3. Manually trigger sync via API:
   ```bash
   curl -X POST https://ca-guardian.yourdomain.com/api/tenants/<id>/sync \
     -H "Authorization: Bearer <jwt-token>"
   ```

---

### Certificate renewal

TLS certificates are managed by cert-manager with Let's Encrypt.
Certificates auto-renew 30 days before expiry.

Check certificate status:
```bash
kubectl -n ca-guardian get certificate
kubectl -n ca-guardian describe certificate ca-guardian-prod-tls
```

---

### Database maintenance

**Manual backup:**
```bash
kubectl -n ca-guardian exec deploy/ca-guardian-postgres -- \
  pg_dump -U ca_guardian_user ca_guardian | gzip > backup-$(date +%Y%m%d).sql.gz
```

**Connect to DB (read-only):**
```bash
kubectl -n ca-guardian exec -it deploy/ca-guardian-postgres -- \
  psql -U ca_guardian_user ca_guardian
```

**Vacuum (if DB is slow):**
```sql
VACUUM ANALYZE ca_policies;
VACUUM ANALYZE policy_versions;
VACUUM ANALYZE change_requests;
VACUUM ANALYZE audit_log;
```

---

### Scaling

**Manual scale up for high load:**
```bash
kubectl -n ca-guardian scale deploy/ca-guardian-backend --replicas=5
kubectl -n ca-guardian scale deploy/ca-guardian-frontend --replicas=4
```

**Update HPA limits:**
Edit `helm/ca-guardian/values-production.yaml`:
```yaml
backend:
  autoscaling:
    maxReplicas: 15
```
Then commit → ArgoCD will apply.

---

## Useful Commands

```bash
# Tail backend logs
kubectl -n ca-guardian logs -f deploy/ca-guardian-backend

# Port-forward backend for local debugging
kubectl -n ca-guardian port-forward svc/ca-guardian-backend 3001:3001

# Check ArgoCD app status
argocd app get ca-guardian-production

# List all Helm releases
helm list -A

# Check resource usage
kubectl -n ca-guardian top pods
kubectl -n ca-guardian top nodes
```
