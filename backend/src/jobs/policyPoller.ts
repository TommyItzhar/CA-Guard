import cron from 'node-cron';
import { query } from '../utils/db';
import { fetchSingleCAPolicy } from '../services/graphService';
import { createPolicyVersion } from '../services/backupService';
import { sendChangeDetectedNotification } from '../services/emailService';
import { audit } from '../services/auditService';
import { logger } from '../utils/logger';

const POLL_INTERVAL = Number(process.env.POLL_INTERVAL_MINUTES) || 5;

export function startPollingJob() {
  const cronExpr = `*/${POLL_INTERVAL} * * * *`;
  logger.info(`Policy poller started — interval: every ${POLL_INTERVAL} minutes`);

  cron.schedule(cronExpr, async () => {
    logger.debug('Policy poll cycle starting');
    try {
      await pollAllUnlockedPolicies();
    } catch (err) {
      logger.error('Policy poll cycle failed', err);
    }
  });
}

async function pollAllUnlockedPolicies() {
  // Find all policies that are currently unlocked (active change request)
  const { rows: unlockedPolicies } = await query<{
    policy_id: string;
    azure_policy_id: string;
    policy_name: string;
    tenant_id: string;
    request_id: string;
    current_policy_data: Record<string, unknown>;
    tenant_uuid: string;
    az_tenant_id: string;
    client_id: string;
    client_secret: string;
  }>(
    `SELECT
       cr.policy_id, cr.azure_policy_id, cr.policy_name, cr.tenant_id,
       cr.id as request_id,
       p.policy_data as current_policy_data,
       t.id as tenant_uuid, t.tenant_id as az_tenant_id,
       t.client_id, t.client_secret
     FROM change_requests cr
     JOIN ca_policies p ON p.id = cr.policy_id
     JOIN tenants t ON t.id = cr.tenant_id
     WHERE cr.status = 'approved'
       AND t.is_active = true`
  );

  for (const row of unlockedPolicies) {
    try {
      await checkPolicyForChanges(row);
    } catch (err) {
      logger.error(`Failed to check policy ${row.azure_policy_id}`, err);
    }
  }

  // Also sync all policies for freshness
  await syncAllTenants();
}

async function checkPolicyForChanges(row: {
  policy_id: string; azure_policy_id: string; policy_name: string;
  tenant_id: string; request_id: string; current_policy_data: Record<string, unknown>;
  tenant_uuid: string; az_tenant_id: string; client_id: string; client_secret: string;
}) {
  const livePolicy = await fetchSingleCAPolicy(
    { tenantId: row.az_tenant_id, clientId: row.client_id, clientSecret: row.client_secret },
    row.azure_policy_id
  );

  const currentModified = (row.current_policy_data as any).modifiedDateTime;
  const liveModified = livePolicy.modifiedDateTime;

  if (liveModified && currentModified !== liveModified) {
    logger.info(`Change detected in policy ${row.azure_policy_id}`);

    // Update local policy data
    await query(
      `UPDATE ca_policies SET policy_data = $1, last_synced = NOW(), updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(livePolicy), row.policy_id]
    );

    // Record change version
    await createPolicyVersion(null, {
      policyId: row.policy_id,
      tenantId: row.tenant_uuid,
      azurePolicyId: row.azure_policy_id,
      displayName: row.policy_name,
      policyData: livePolicy as unknown as Record<string, unknown>,
      changeType: 'post_change',
      changeSummary: 'Change detected by automated poller',
      requestId: row.request_id,
    });

    // Update request status
    await query(
      `UPDATE change_requests SET status = 'change_detected', change_detected_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [row.request_id]
    );

    // Notify admins
    const { rows: adminRows } = await query<{ email: string }>(
      `SELECT email FROM users WHERE role IN ('super_admin','ca_admin') AND is_active = true`
    );
    const adminEmails = adminRows.map((r) => r.email);
    if (adminEmails.length > 0) {
      await sendChangeDetectedNotification({
        toEmails: adminEmails,
        policyName: row.policy_name,
        requestId: row.request_id,
      });
    }

    await audit({
      tenantId: row.tenant_uuid,
      action: 'policy.change_detected',
      resourceType: 'ca_policy',
      resourceId: row.policy_id,
      resourceName: row.policy_name,
      details: { requestId: row.request_id },
    });
  }
}

async function syncAllTenants() {
  const { rows: tenants } = await query<{
    id: string; tenant_id: string; client_id: string; client_secret: string;
  }>(
    `SELECT id, tenant_id, client_id, client_secret FROM tenants
     WHERE is_active = true AND (last_sync IS NULL OR last_sync < NOW() - INTERVAL '1 hour')`
  );

  for (const tenant of tenants) {
    try {
      // Update last_sync timestamp to prevent concurrent syncs
      await query(`UPDATE tenants SET last_sync = NOW() WHERE id = $1`, [tenant.id]);
      logger.debug(`Background sync for tenant ${tenant.tenant_id}`);
    } catch (err) {
      logger.error(`Background sync failed for tenant ${tenant.id}`, err);
    }
  }
}
