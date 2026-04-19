import { Router, Request, Response } from 'express';
import { query, withTransaction } from '../utils/db';
import { authenticate, requireRole } from '../middleware/auth';
import { createPolicyVersion } from '../services/backupService';
import { rollbackCAPolicy } from '../services/graphService';
import { sendRollbackNotification } from '../services/emailService';
import { audit } from '../services/auditService';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();
router.use(authenticate);

// GET /api/versions?policyId=...
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { policyId } = req.query as { policyId: string };
  if (!policyId) throw new AppError(400, 'policyId is required');

  const { rows } = await query(
    `SELECT pv.id, pv.version_number, pv.change_type, pv.change_summary,
            pv.created_at, pv.request_id,
            u.display_name as created_by_name,
            cr.status as request_status
     FROM policy_versions pv
     LEFT JOIN users u ON u.id = pv.created_by
     LEFT JOIN change_requests cr ON cr.id = pv.request_id
     WHERE pv.policy_id = $1
     ORDER BY pv.version_number DESC`,
    [policyId]
  );
  res.json(rows);
}));

// GET /api/versions/:id - Get full version data
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { rows } = await query(
    `SELECT pv.*, u.display_name as created_by_name
     FROM policy_versions pv
     LEFT JOIN users u ON u.id = pv.created_by
     WHERE pv.id = $1`,
    [req.params.id]
  );
  if (!rows[0]) throw new AppError(404, 'Version not found');
  res.json(rows[0]);
}));

// POST /api/versions/:id/rollback - One-click rollback
router.post(
  '/:id/rollback',
  requireRole('super_admin', 'ca_admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await withTransaction(async (client) => {
      // Get target version
      const { rows: verRows } = await client.query<{
        id: string; policy_id: string; version_number: number;
        policy_data: Record<string, unknown>; display_name: string;
        azure_policy_id: string; tenant_id: string;
      }>(
        'SELECT * FROM policy_versions WHERE id = $1',
        [req.params.id]
      );
      if (!verRows[0]) throw new AppError(404, 'Version not found');
      const version = verRows[0];

      // Get policy and tenant creds
      const { rows: policyRows } = await client.query<{
        id: string; tenant_id: string; is_locked: boolean; policy_data: Record<string, unknown>;
      }>(
        'SELECT p.id, p.tenant_id, p.is_locked, p.policy_data FROM ca_policies p WHERE p.id = $1',
        [version.policy_id]
      );
      if (!policyRows[0]) throw new AppError(404, 'Policy not found');
      const policy = policyRows[0];

      const { rows: tenantRows } = await client.query<{
        tenant_id: string; client_id: string; client_secret: string;
      }>(
        'SELECT tenant_id, client_id, client_secret FROM tenants WHERE id = $1 AND is_active = true',
        [version.tenant_id]
      );
      if (!tenantRows[0]) throw new AppError(404, 'Active tenant not found');
      const tenant = tenantRows[0];

      // Backup current state before rollback
      await createPolicyVersion(client, {
        policyId: policy.id,
        tenantId: version.tenant_id,
        azurePolicyId: version.azure_policy_id,
        displayName: version.display_name,
        policyData: policy.policy_data as Record<string, unknown>,
        changeType: 'pre_change',
        changeSummary: `Pre-rollback backup (rolling back to v${version.version_number})`,
        createdBy: req.user!.id,
      });

      // Apply rollback to Azure
      await rollbackCAPolicy(
        { tenantId: tenant.tenant_id, clientId: tenant.client_id, clientSecret: tenant.client_secret },
        version.azure_policy_id,
        version.policy_data as any
      );

      // Save rollback version
      const rollbackVersionId = await createPolicyVersion(client, {
        policyId: policy.id,
        tenantId: version.tenant_id,
        azurePolicyId: version.azure_policy_id,
        displayName: version.display_name,
        policyData: version.policy_data as Record<string, unknown>,
        changeType: 'rollback',
        changeSummary: `Rolled back to v${version.version_number} by ${req.user!.display_name}`,
        createdBy: req.user!.id,
      });

      // Update policy record with rolled-back data and re-lock
      await client.query(
        `UPDATE ca_policies SET
           policy_data = $1, is_locked = true, updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify(version.policy_data), policy.id]
      );

      return { version, policy, rollbackVersionId };
    });

    // Send notifications
    const { rows: adminRows } = await query<{ email: string }>(
      `SELECT email FROM users WHERE role IN ('super_admin','ca_admin') AND is_active = true`
    );
    const adminEmails = adminRows.map(r => r.email);
    if (adminEmails.length > 0) {
      await sendRollbackNotification({
        toEmails: adminEmails,
        policyName: result.version.display_name,
        rolledBackBy: req.user!.display_name,
        versionNumber: result.version.version_number,
      });
    }

    await audit({
      tenantId: result.version.tenant_id,
      userId: req.user!.id,
      userName: req.user!.display_name,
      action: 'policy.rolled_back',
      resourceType: 'ca_policy',
      resourceId: result.version.policy_id,
      resourceName: result.version.display_name,
      details: {
        targetVersionId: result.version.id,
        targetVersionNumber: result.version.version_number,
        rollbackVersionId: result.rollbackVersionId,
      },
    });

    logger.info('Policy rolled back', {
      policyId: result.version.policy_id,
      toVersion: result.version.version_number,
      by: req.user!.email,
    });

    res.json({
      message: `Policy successfully rolled back to version ${result.version.version_number}`,
      rollbackVersionId: result.rollbackVersionId,
    });
  })
);

export default router;
