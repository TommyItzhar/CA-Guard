import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query, withTransaction } from '../utils/db';
import { authenticate, requireRole } from '../middleware/auth';
import { audit } from '../services/auditService';
import { createPolicyVersion } from '../services/backupService';
import {
  sendChangeRequestNotification,
  sendApprovalNotification,
  sendChangeDetectedNotification,
} from '../services/emailService';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();
router.use(authenticate);

async function getAdminEmails(): Promise<string[]> {
  const envEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()).filter(Boolean) || [];
  const { rows } = await query<{ email: string }>(
    `SELECT email FROM users WHERE role IN ('super_admin', 'ca_admin') AND is_active = true`
  );
  const dbEmails = rows.map(r => r.email);
  return [...new Set([...envEmails, ...dbEmails])];
}

// GET /api/change-requests
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { tenantId, status, policyId } = req.query as Record<string, string>;
  const conditions: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  // azure_admins can only see their own requests
  if (req.user!.role === 'azure_admin') {
    conditions.push(`cr.requester_id = $${i++}`);
    params.push(req.user!.id);
  }

  if (tenantId) { conditions.push(`cr.tenant_id = $${i++}`); params.push(tenantId); }
  if (status) { conditions.push(`cr.status = $${i++}`); params.push(status); }
  if (policyId) { conditions.push(`cr.policy_id = $${i++}`); params.push(policyId); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await query(
    `SELECT cr.*, t.display_name as tenant_name,
            u.display_name as requester_display_name,
            a.display_name as approver_display_name
     FROM change_requests cr
     JOIN tenants t ON t.id = cr.tenant_id
     JOIN users u ON u.id = cr.requester_id
     LEFT JOIN users a ON a.id = cr.approver_id
     ${where}
     ORDER BY cr.created_at DESC`,
    params
  );
  res.json(rows);
}));

// GET /api/change-requests/:id
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { rows } = await query(
    `SELECT cr.*, t.display_name as tenant_name,
            u.display_name as requester_display_name,
            a.display_name as approver_display_name,
            pre.version_number as pre_version_number,
            post.version_number as post_version_number
     FROM change_requests cr
     JOIN tenants t ON t.id = cr.tenant_id
     JOIN users u ON u.id = cr.requester_id
     LEFT JOIN users a ON a.id = cr.approver_id
     LEFT JOIN policy_versions pre ON pre.id = cr.pre_change_version_id
     LEFT JOIN policy_versions post ON post.id = cr.post_change_version_id
     WHERE cr.id = $1`,
    [req.params.id]
  );
  if (!rows[0]) throw new AppError(404, 'Change request not found');
  res.json(rows[0]);
}));

// POST /api/change-requests - Submit a new change request
router.post(
  '/',
  requireRole('super_admin', 'ca_admin', 'azure_admin'),
  [
    body('policyId').isUUID(),
    body('justification').trim().isLength({ min: 10, max: 2000 }),
    body('plannedChanges').optional().trim().isLength({ max: 5000 }),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw new AppError(400, 'Validation failed', errors.array());

    const { policyId, justification, plannedChanges } = req.body;

    const { rows: policyRows } = await query<{
      id: string; display_name: string; tenant_id: string; is_locked: boolean; azure_policy_id: string;
    }>(
      'SELECT id, display_name, tenant_id, is_locked, azure_policy_id FROM ca_policies WHERE id = $1',
      [policyId]
    );
    if (!policyRows[0]) throw new AppError(404, 'Policy not found');
    const policy = policyRows[0];

    // Check for existing pending/approved/unlocked requests
    const { rows: existing } = await query(
      `SELECT id FROM change_requests
       WHERE policy_id = $1 AND status IN ('pending','approved','unlocked','change_detected')`,
      [policyId]
    );
    if (existing.length > 0) {
      throw new AppError(409, 'A change request for this policy is already in progress');
    }

    const { rows: newReq } = await query<{ id: string }>(
      `INSERT INTO change_requests
         (tenant_id, policy_id, azure_policy_id, policy_name, requester_id, requester_name,
          justification, planned_changes, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending')
       RETURNING id`,
      [
        policy.tenant_id, policyId, policy.azure_policy_id, policy.display_name,
        req.user!.id, req.user!.display_name, justification, plannedChanges || null,
      ]
    );

    const adminEmails = await getAdminEmails();
    await sendChangeRequestNotification({
      toEmails: adminEmails,
      requesterName: req.user!.display_name,
      policyName: policy.display_name,
      justification,
      requestId: newReq[0].id,
    });

    await audit({
      tenantId: policy.tenant_id,
      userId: req.user!.id,
      userName: req.user!.display_name,
      action: 'change_request.created',
      resourceType: 'change_request',
      resourceId: newReq[0].id,
      resourceName: policy.display_name,
      details: { justification },
    });

    res.status(201).json({ id: newReq[0].id, message: 'Change request submitted successfully' });
  })
);

// POST /api/change-requests/:id/approve
router.post(
  '/:id/approve',
  requireRole('super_admin', 'ca_admin'),
  [body('note').optional().trim().isLength({ max: 1000 })],
  asyncHandler(async (req: Request, res: Response) => {
    const { note } = req.body;

    const result = await withTransaction(async (client) => {
      const { rows: reqRows } = await client.query<{
        id: string; policy_id: string; tenant_id: string; policy_name: string;
        status: string; requester_id: string; azure_policy_id: string;
      }>(
        'SELECT * FROM change_requests WHERE id = $1 FOR UPDATE',
        [req.params.id]
      );
      const cr = reqRows[0];
      if (!cr) throw new AppError(404, 'Change request not found');
      if (cr.status !== 'pending') throw new AppError(409, `Cannot approve request in status: ${cr.status}`);

      // Take pre-change backup
      const { rows: policyRows } = await client.query<{
        id: string; policy_data: Record<string, unknown>; display_name: string;
      }>(
        'SELECT id, policy_data, display_name FROM ca_policies WHERE id = $1',
        [cr.policy_id]
      );
      const policy = policyRows[0];

      const preVersionId = await createPolicyVersion(client, {
        policyId: policy.id,
        tenantId: cr.tenant_id,
        azurePolicyId: cr.azure_policy_id,
        displayName: policy.display_name,
        policyData: policy.policy_data as Record<string, unknown>,
        changeType: 'pre_change',
        changeSummary: `Pre-change backup for request ${cr.id}`,
        createdBy: req.user!.id,
        requestId: cr.id,
      });

      // Unlock policy
      await client.query(
        `UPDATE ca_policies SET is_locked = false, updated_at = NOW() WHERE id = $1`,
        [cr.policy_id]
      );

      // Mark 2-hour auto-lock expiry
      await client.query(
        `UPDATE change_requests SET
           status = 'approved',
           approver_id = $1,
           approver_name = $2,
           approval_note = $3,
           approved_at = NOW(),
           unlocked_at = NOW(),
           lock_expires_at = NOW() + INTERVAL '2 hours',
           pre_change_version_id = $4,
           updated_at = NOW()
         WHERE id = $5`,
        [req.user!.id, req.user!.display_name, note || null, preVersionId, cr.id]
      );

      return { cr, policy };
    });

    // Notify requester
    const { rows: requesterRows } = await query<{ email: string }>(
      'SELECT email FROM users WHERE id = $1', [result.cr.requester_id]
    );
    if (requesterRows[0]) {
      await sendApprovalNotification({
        toEmail: requesterRows[0].email,
        approved: true,
        approverName: req.user!.display_name,
        policyName: result.cr.policy_name,
        note,
        requestId: result.cr.id,
      });
    }

    await audit({
      tenantId: result.cr.tenant_id,
      userId: req.user!.id,
      userName: req.user!.display_name,
      action: 'change_request.approved',
      resourceType: 'change_request',
      resourceId: result.cr.id,
      resourceName: result.cr.policy_name,
      details: { note },
    });

    res.json({ message: 'Request approved. Policy unlocked for 2 hours.' });
  })
);

// POST /api/change-requests/:id/reject
router.post(
  '/:id/reject',
  requireRole('super_admin', 'ca_admin'),
  [body('note').trim().isLength({ min: 1, max: 1000 })],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw new AppError(400, 'Rejection note is required');

    const { rows: reqRows } = await query<{
      id: string; status: string; policy_name: string; requester_id: string; tenant_id: string;
    }>(
      `UPDATE change_requests SET
         status = 'rejected', approver_id = $1, approver_name = $2,
         approval_note = $3, approved_at = NOW(), updated_at = NOW()
       WHERE id = $4 AND status = 'pending'
       RETURNING id, status, policy_name, requester_id, tenant_id`,
      [req.user!.id, req.user!.display_name, req.body.note, req.params.id]
    );
    if (!reqRows[0]) throw new AppError(404, 'Pending change request not found');

    const { rows: requesterRows } = await query<{ email: string }>(
      'SELECT email FROM users WHERE id = $1', [reqRows[0].requester_id]
    );
    if (requesterRows[0]) {
      await sendApprovalNotification({
        toEmail: requesterRows[0].email,
        approved: false,
        approverName: req.user!.display_name,
        policyName: reqRows[0].policy_name,
        note: req.body.note,
        requestId: reqRows[0].id,
      });
    }

    await audit({
      tenantId: reqRows[0].tenant_id,
      userId: req.user!.id,
      userName: req.user!.display_name,
      action: 'change_request.rejected',
      resourceType: 'change_request',
      resourceId: reqRows[0].id,
      resourceName: reqRows[0].policy_name,
      details: { note: req.body.note },
    });

    res.json({ message: 'Request rejected' });
  })
);

// POST /api/change-requests/:id/complete - Admin marks change as reviewed & complete
router.post(
  '/:id/complete',
  requireRole('super_admin', 'ca_admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await withTransaction(async (client) => {
      const { rows: reqRows } = await client.query<{
        id: string; policy_id: string; tenant_id: string; policy_name: string;
        status: string; azure_policy_id: string;
      }>(
        'SELECT * FROM change_requests WHERE id = $1 FOR UPDATE',
        [req.params.id]
      );
      const cr = reqRows[0];
      if (!cr) throw new AppError(404, 'Change request not found');
      if (!['change_detected', 'unlocked'].includes(cr.status)) {
        throw new AppError(409, `Cannot complete request in status: ${cr.status}`);
      }

      // Take post-change snapshot
      const { rows: policyRows } = await client.query<{
        id: string; policy_data: Record<string, unknown>; display_name: string;
      }>(
        'SELECT id, policy_data, display_name FROM ca_policies WHERE id = $1',
        [cr.policy_id]
      );
      const policy = policyRows[0];

      const postVersionId = await createPolicyVersion(client, {
        policyId: policy.id,
        tenantId: cr.tenant_id,
        azurePolicyId: cr.azure_policy_id,
        displayName: policy.display_name,
        policyData: policy.policy_data as Record<string, unknown>,
        changeType: 'post_change',
        changeSummary: `Post-change backup for request ${cr.id}`,
        createdBy: req.user!.id,
        requestId: cr.id,
      });

      // Re-lock policy
      await client.query(
        'UPDATE ca_policies SET is_locked = true, updated_at = NOW() WHERE id = $1',
        [cr.policy_id]
      );

      await client.query(
        `UPDATE change_requests SET
           status = 'completed', post_change_version_id = $1,
           completed_at = NOW(), updated_at = NOW()
         WHERE id = $2`,
        [postVersionId, cr.id]
      );

      return cr;
    });

    await audit({
      tenantId: result.tenant_id,
      userId: req.user!.id,
      userName: req.user!.display_name,
      action: 'change_request.completed',
      resourceType: 'change_request',
      resourceId: result.id,
      resourceName: result.policy_name,
    });

    res.json({ message: 'Change request completed. Policy re-locked.' });
  })
);

// POST /api/change-requests/:id/cancel
router.post('/:id/cancel', asyncHandler(async (req: Request, res: Response) => {
  const { rows } = await query<{
    id: string; requester_id: string; status: string; policy_id: string;
    tenant_id: string; policy_name: string;
  }>(
    'SELECT id, requester_id, status, policy_id, tenant_id, policy_name FROM change_requests WHERE id = $1',
    [req.params.id]
  );
  if (!rows[0]) throw new AppError(404, 'Change request not found');

  // Only requester or admins can cancel
  if (rows[0].requester_id !== req.user!.id && !['super_admin', 'ca_admin'].includes(req.user!.role)) {
    throw new AppError(403, 'Not authorized to cancel this request');
  }
  if (rows[0].status !== 'pending') {
    throw new AppError(409, `Cannot cancel request in status: ${rows[0].status}`);
  }

  await query(
    `UPDATE change_requests SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
    [req.params.id]
  );

  await audit({
    tenantId: rows[0].tenant_id,
    userId: req.user!.id,
    userName: req.user!.display_name,
    action: 'change_request.cancelled',
    resourceType: 'change_request',
    resourceId: rows[0].id,
    resourceName: rows[0].policy_name,
  });

  res.json({ message: 'Change request cancelled' });
}));

export default router;
