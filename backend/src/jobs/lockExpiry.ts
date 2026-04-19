import cron from 'node-cron';
import { query } from '../utils/db';
import { audit } from '../services/auditService';
import { logger } from '../utils/logger';

export function startLockExpiryJob() {
  // Check every 15 minutes for expired unlocks
  cron.schedule('*/15 * * * *', async () => {
    try {
      await expireUnlockedPolicies();
    } catch (err) {
      logger.error('Lock expiry job failed', err);
    }
  });
  logger.info('Lock expiry job started');
}

async function expireUnlockedPolicies() {
  // Find approved requests past their lock expiry
  const { rows: expired } = await query<{
    id: string; policy_id: string; policy_name: string; tenant_id: string;
  }>(
    `SELECT id, policy_id, policy_name, tenant_id
     FROM change_requests
     WHERE status = 'approved'
       AND lock_expires_at IS NOT NULL
       AND lock_expires_at < NOW()`
  );

  if (expired.length === 0) return;

  logger.info(`Expiring ${expired.length} unlocked policies`);

  for (const req of expired) {
    try {
      // Re-lock the policy
      await query(
        'UPDATE ca_policies SET is_locked = true, updated_at = NOW() WHERE id = $1',
        [req.policy_id]
      );

      // Cancel the stale request
      await query(
        `UPDATE change_requests SET
           status = 'cancelled',
           approval_note = 'Auto-cancelled: unlock period expired without detected change',
           updated_at = NOW()
         WHERE id = $1`,
        [req.id]
      );

      await audit({
        tenantId: req.tenant_id,
        action: 'policy.auto_locked',
        resourceType: 'ca_policy',
        resourceId: req.policy_id,
        resourceName: req.policy_name,
        details: { reason: 'unlock_expired', requestId: req.id },
      });

      logger.info(`Auto-locked policy ${req.policy_id} after expiry`);
    } catch (err) {
      logger.error(`Failed to expire lock for request ${req.id}`, err);
    }
  }
}
