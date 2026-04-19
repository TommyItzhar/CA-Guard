import { Router, Request, Response } from 'express';
import { query } from '../utils/db';
import { authenticate, requireRole } from '../middleware/auth';
import { audit } from '../services/auditService';
import { AppError, asyncHandler } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate);

// GET /api/policies?tenantId=...
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { tenantId, search, state, locked } = req.query as Record<string, string>;
  const conditions: string[] = ['1=1'];
  const params: unknown[] = [];
  let i = 1;

  if (tenantId) { conditions.push(`p.tenant_id = $${i++}`); params.push(tenantId); }
  if (search) { conditions.push(`p.display_name ILIKE $${i++}`); params.push(`%${search}%`); }
  if (state) { conditions.push(`p.state = $${i++}`); params.push(state); }
  if (locked !== undefined) { conditions.push(`p.is_locked = $${i++}`); params.push(locked === 'true'); }

  const { rows } = await query(
    `SELECT p.id, p.azure_policy_id, p.display_name, p.state, p.is_locked,
            p.last_synced, p.created_at, p.updated_at,
            t.display_name as tenant_name, t.id as tenant_id,
            (SELECT COUNT(*) FROM policy_versions pv WHERE pv.policy_id = p.id) as version_count,
            (SELECT COUNT(*) FROM change_requests cr WHERE cr.policy_id = p.id AND cr.status NOT IN ('completed','rejected','cancelled')) as active_requests
     FROM ca_policies p
     JOIN tenants t ON t.id = p.tenant_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY p.display_name`,
    params
  );
  res.json(rows);
}));

// GET /api/policies/:id
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { rows } = await query(
    `SELECT p.*, t.display_name as tenant_name
     FROM ca_policies p
     JOIN tenants t ON t.id = p.tenant_id
     WHERE p.id = $1`,
    [req.params.id]
  );
  if (!rows[0]) throw new AppError(404, 'Policy not found');
  res.json(rows[0]);
}));

// PATCH /api/policies/:id/lock - Lock a policy
router.patch('/:id/lock', requireRole('super_admin', 'ca_admin'), asyncHandler(async (req: Request, res: Response) => {
  const { rows } = await query<{ display_name: string; tenant_id: string }>(
    `UPDATE ca_policies SET is_locked = true, updated_at = NOW()
     WHERE id = $1 RETURNING display_name, tenant_id`,
    [req.params.id]
  );
  if (!rows[0]) throw new AppError(404, 'Policy not found');

  await audit({
    tenantId: rows[0].tenant_id,
    userId: req.user!.id,
    userName: req.user!.display_name,
    action: 'policy.locked',
    resourceType: 'ca_policy',
    resourceId: req.params.id,
    resourceName: rows[0].display_name,
  });

  res.json({ message: 'Policy locked successfully' });
}));

// PATCH /api/policies/:id/unlock - Unlock (called by workflow service, not directly)
router.patch('/:id/unlock', requireRole('super_admin', 'ca_admin'), asyncHandler(async (req: Request, res: Response) => {
  const { rows } = await query<{ display_name: string; tenant_id: string }>(
    `UPDATE ca_policies SET is_locked = false, updated_at = NOW()
     WHERE id = $1 RETURNING display_name, tenant_id`,
    [req.params.id]
  );
  if (!rows[0]) throw new AppError(404, 'Policy not found');

  await audit({
    tenantId: rows[0].tenant_id,
    userId: req.user!.id,
    userName: req.user!.display_name,
    action: 'policy.unlocked',
    resourceType: 'ca_policy',
    resourceId: req.params.id,
    resourceName: rows[0].display_name,
  });

  res.json({ message: 'Policy unlocked successfully' });
}));

// GET /api/policies/:id/diff?v1=versionId&v2=versionId
router.get('/:id/diff', asyncHandler(async (req: Request, res: Response) => {
  const { v1, v2 } = req.query as { v1: string; v2: string };
  if (!v1 || !v2) throw new AppError(400, 'Both v1 and v2 version IDs are required');

  const { rows } = await query(
    `SELECT id, version_number, policy_data, change_type, change_summary, created_at
     FROM policy_versions
     WHERE id IN ($1, $2) AND policy_id = $3`,
    [v1, v2, req.params.id]
  );

  if (rows.length < 2) throw new AppError(404, 'One or both versions not found');
  res.json({ versions: rows });
}));

export default router;
