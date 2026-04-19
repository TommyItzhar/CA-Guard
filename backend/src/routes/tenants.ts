import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../utils/db';
import { authenticate, requireRole } from '../middleware/auth';
import { verifyTenantCredentials, fetchAllCAPolicies } from '../services/graphService';
import { audit } from '../services/auditService';
import { createPolicyVersion } from '../services/backupService';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();
router.use(authenticate);

// GET /api/tenants
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { rows } = await query(
    `SELECT id, tenant_id, display_name, is_active, last_sync, sync_status, created_at
     FROM tenants
     ORDER BY display_name`,
  );
  res.json(rows);
}));

// GET /api/tenants/:id
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { rows } = await query(
    `SELECT id, tenant_id, display_name, client_id, is_active, last_sync, sync_status, created_at
     FROM tenants WHERE id = $1`,
    [req.params.id]
  );
  if (!rows[0]) throw new AppError(404, 'Tenant not found');
  res.json(rows[0]);
}));

// POST /api/tenants - Register a new tenant
router.post(
  '/',
  requireRole('super_admin'),
  [
    body('tenantId').isUUID().withMessage('Invalid tenant ID format'),
    body('displayName').trim().isLength({ min: 1, max: 255 }),
    body('clientId').isUUID().withMessage('Invalid client ID format'),
    body('clientSecret').isLength({ min: 1 }),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw new AppError(400, 'Validation failed', errors.array());

    const { tenantId, displayName, clientId, clientSecret } = req.body;

    // Verify credentials before saving
    const verification = await verifyTenantCredentials({ tenantId, clientId, clientSecret });
    if (!verification.valid) {
      throw new AppError(400, `Tenant credentials invalid: ${verification.error}`);
    }

    const { rows } = await query<{ id: string }>(
      `INSERT INTO tenants (tenant_id, display_name, client_id, client_secret, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [tenantId, verification.tenantName || displayName, clientId, clientSecret, req.user!.id]
    );

    await audit({
      userId: req.user!.id,
      userName: req.user!.display_name,
      action: 'tenant.created',
      resourceType: 'tenant',
      resourceId: rows[0].id,
      resourceName: displayName,
    });

    res.status(201).json({ id: rows[0].id, message: 'Tenant registered successfully' });
  })
);

// POST /api/tenants/:id/sync - Sync policies from Azure
router.post('/:id/sync', requireRole('super_admin', 'ca_admin'), asyncHandler(async (req: Request, res: Response) => {
  const { rows: tenantRows } = await query<{
    id: string; tenant_id: string; client_id: string; client_secret: string; display_name: string;
  }>(
    'SELECT id, tenant_id, client_id, client_secret, display_name FROM tenants WHERE id = $1 AND is_active = true',
    [req.params.id]
  );

  if (!tenantRows[0]) throw new AppError(404, 'Tenant not found');
  const tenant = tenantRows[0];

  await query('UPDATE tenants SET sync_status = $1 WHERE id = $2', ['syncing', tenant.id]);

  try {
    const policies = await fetchAllCAPolicies({
      tenantId: tenant.tenant_id,
      clientId: tenant.client_id,
      clientSecret: tenant.client_secret,
    });

    let created = 0, updated = 0;

    for (const policy of policies) {
      const { rows: existing } = await query<{ id: string; policy_data: Record<string, unknown> }>(
        'SELECT id, policy_data FROM ca_policies WHERE tenant_id = $1 AND azure_policy_id = $2',
        [tenant.id, policy.id]
      );

      if (existing[0]) {
        await query(
          `UPDATE ca_policies SET display_name=$1, state=$2, policy_data=$3, last_synced=NOW()
           WHERE id = $4`,
          [policy.displayName, policy.state, JSON.stringify(policy), existing[0].id]
        );
        await createPolicyVersion(null, {
          policyId: existing[0].id,
          tenantId: tenant.id,
          azurePolicyId: policy.id,
          displayName: policy.displayName,
          policyData: policy as unknown as Record<string, unknown>,
          changeType: 'sync',
          changeSummary: 'Sync from Azure',
          createdBy: req.user?.id,
        });
        updated++;
      } else {
        const { rows: newPolicy } = await query<{ id: string }>(
          `INSERT INTO ca_policies (tenant_id, azure_policy_id, display_name, state, policy_data, is_locked)
           VALUES ($1, $2, $3, $4, $5, true)
           RETURNING id`,
          [tenant.id, policy.id, policy.displayName, policy.state, JSON.stringify(policy)]
        );
        await createPolicyVersion(null, {
          policyId: newPolicy[0].id,
          tenantId: tenant.id,
          azurePolicyId: policy.id,
          displayName: policy.displayName,
          policyData: policy as unknown as Record<string, unknown>,
          changeType: 'initial',
          changeSummary: 'Initial import from Azure',
          createdBy: req.user?.id,
        });
        created++;
      }
    }

    await query(
      `UPDATE tenants SET sync_status = 'success', last_sync = NOW() WHERE id = $1`,
      [tenant.id]
    );

    await audit({
      tenantId: tenant.id,
      userId: req.user!.id,
      userName: req.user!.display_name,
      action: 'tenant.synced',
      resourceType: 'tenant',
      resourceId: tenant.id,
      resourceName: tenant.display_name,
      details: { created, updated, total: policies.length },
    });

    res.json({ message: 'Sync complete', created, updated, total: policies.length });
  } catch (err) {
    await query(`UPDATE tenants SET sync_status = 'error' WHERE id = $1`, [req.params.id]);
    logger.error('Sync failed', err);
    throw new AppError(500, 'Sync failed — check tenant credentials and API permissions');
  }
}));

// DELETE /api/tenants/:id
router.delete('/:id', requireRole('super_admin'), asyncHandler(async (req: Request, res: Response) => {
  const { rows } = await query<{ display_name: string }>(
    'UPDATE tenants SET is_active = false WHERE id = $1 RETURNING display_name',
    [req.params.id]
  );
  if (!rows[0]) throw new AppError(404, 'Tenant not found');

  await audit({
    userId: req.user!.id,
    userName: req.user!.display_name,
    action: 'tenant.deactivated',
    resourceType: 'tenant',
    resourceId: req.params.id,
    resourceName: rows[0].display_name,
  });

  res.json({ message: 'Tenant deactivated' });
}));

export default router;
