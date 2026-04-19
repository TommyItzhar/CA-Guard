import { PoolClient } from 'pg';
import { query, withTransaction } from '../utils/db';
import { logger } from '../utils/logger';

interface PolicyVersion {
  id: string;
  policy_id: string;
  version_number: number;
  policy_data: Record<string, unknown>;
  change_type: string;
  change_summary: string | null;
  created_by: string | null;
  created_at: string;
}

export async function createPolicyVersion(
  client: PoolClient | null,
  opts: {
    policyId: string;
    tenantId: string;
    azurePolicyId: string;
    displayName: string;
    policyData: Record<string, unknown>;
    changeType: 'initial' | 'pre_change' | 'post_change' | 'rollback' | 'sync';
    changeSummary?: string;
    createdBy?: string;
    requestId?: string;
  }
): Promise<string> {
  const { rows: versionRows } = await query<{ max: string }>(
    'SELECT MAX(version_number) as max FROM policy_versions WHERE policy_id = $1',
    [opts.policyId]
  );
  const nextVersion = (Number(versionRows[0]?.max) || 0) + 1;

  const fn = async (c: PoolClient) => {
    const { rows } = await c.query<{ id: string }>(
      `INSERT INTO policy_versions
         (policy_id, tenant_id, azure_policy_id, display_name, version_number,
          policy_data, change_type, change_summary, created_by, request_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        opts.policyId,
        opts.tenantId,
        opts.azurePolicyId,
        opts.displayName,
        nextVersion,
        JSON.stringify(opts.policyData),
        opts.changeType,
        opts.changeSummary ?? null,
        opts.createdBy ?? null,
        opts.requestId ?? null,
      ]
    );
    return rows[0].id;
  };

  if (client) {
    return fn(client);
  }
  return withTransaction(fn);
}

export async function getPolicyVersions(
  policyId: string,
  limit = 50
): Promise<PolicyVersion[]> {
  const { rows } = await query<PolicyVersion>(
    `SELECT pv.*, u.display_name as created_by_name
     FROM policy_versions pv
     LEFT JOIN users u ON u.id = pv.created_by
     WHERE pv.policy_id = $1
     ORDER BY pv.version_number DESC
     LIMIT $2`,
    [policyId, limit]
  );
  return rows;
}

export async function getVersionById(versionId: string): Promise<PolicyVersion | null> {
  const { rows } = await query<PolicyVersion>(
    'SELECT * FROM policy_versions WHERE id = $1',
    [versionId]
  );
  return rows[0] ?? null;
}

export async function computeDiff(
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>
): Promise<{ added: string[]; removed: string[]; changed: string[] }> {
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];

  const oldStr = JSON.stringify(oldData, null, 2);
  const newStr = JSON.stringify(newData, null, 2);
  const oldLines = oldStr.split('\n');
  const newLines = newStr.split('\n');

  // Simple line-based diff
  const oldSet = new Set(oldLines);
  const newSet = new Set(newLines);

  for (const line of newLines) {
    if (!oldSet.has(line)) added.push(line);
  }
  for (const line of oldLines) {
    if (!newSet.has(line)) removed.push(line);
  }

  logger.debug('Policy diff computed', { addedCount: added.length, removedCount: removed.length });
  return { added, removed, changed };
}

export async function backupAllPolicies(
  tenantId: string,
  policies: Array<{ id: string; azure_policy_id: string; display_name: string; policy_data: Record<string, unknown> }>
): Promise<void> {
  for (const policy of policies) {
    try {
      await createPolicyVersion(null, {
        policyId: policy.id,
        tenantId,
        azurePolicyId: policy.azure_policy_id,
        displayName: policy.display_name,
        policyData: policy.policy_data,
        changeType: 'sync',
        changeSummary: 'Automated sync backup',
      });
    } catch (err) {
      logger.error(`Failed to backup policy ${policy.id}`, err);
    }
  }
}
