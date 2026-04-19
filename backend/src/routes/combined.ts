import { Router, Request, Response } from 'express';
import { query } from '../utils/db';
import { authenticate, requireRole } from '../middleware/auth';
import { getAuditLog } from '../services/auditService';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { body, validationResult } from 'express-validator';

// ─── Audit Routes ──────────────────────────────────────────────────────────────
export const auditRouter = Router();
auditRouter.use(authenticate, requireRole('super_admin', 'ca_admin'));

auditRouter.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { tenantId, userId, action, limit, offset } = req.query as Record<string, string>;
  const result = await getAuditLog({
    tenantId, userId, action,
    limit: limit ? Number(limit) : 50,
    offset: offset ? Number(offset) : 0,
  });
  res.json(result);
}));

auditRouter.get('/export', asyncHandler(async (req: Request, res: Response) => {
  const { tenantId, format = 'json' } = req.query as Record<string, string>;
  const result = await getAuditLog({ tenantId, limit: 10000, offset: 0 });

  if (format === 'csv') {
    const headers = ['id', 'created_at', 'user_name', 'action', 'resource_type', 'resource_name', 'ip_address'];
    const csv = [
      headers.join(','),
      ...(result.rows as Record<string, unknown>[]).map(row =>
        headers.map(h => {
          const val = String(row[h] ?? '');
          return `"${val.replace(/"/g, '""')}"`;
        }).join(',')
      ),
    ].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=ca-guardian-audit.csv');
    return res.send(csv);
  }

  res.setHeader('Content-Disposition', 'attachment; filename=ca-guardian-audit.json');
  res.json(result.rows);
}));

// ─── Users Routes ──────────────────────────────────────────────────────────────
export const usersRouter = Router();
usersRouter.use(authenticate);

usersRouter.get('/', requireRole('super_admin', 'ca_admin'), asyncHandler(async (req: Request, res: Response) => {
  const { rows } = await query(
    `SELECT id, display_name, email, role, is_active, last_login, created_at
     FROM users ORDER BY display_name`
  );
  res.json(rows);
}));

usersRouter.patch(
  '/:id/role',
  requireRole('super_admin'),
  [body('role').isIn(['super_admin', 'ca_admin', 'azure_admin', 'viewer'])],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw new AppError(400, 'Invalid role');

    const { rows } = await query<{ display_name: string }>(
      `UPDATE users SET role = $1, updated_at = NOW()
       WHERE id = $2 RETURNING display_name`,
      [req.body.role, req.params.id]
    );
    if (!rows[0]) throw new AppError(404, 'User not found');
    res.json({ message: `Role updated for ${rows[0].display_name}` });
  })
);

usersRouter.patch('/:id/status', requireRole('super_admin'), asyncHandler(async (req: Request, res: Response) => {
  const { rows } = await query<{ display_name: string }>(
    `UPDATE users SET is_active = $1, updated_at = NOW()
     WHERE id = $2 RETURNING display_name`,
    [req.body.isActive, req.params.id]
  );
  if (!rows[0]) throw new AppError(404, 'User not found');
  res.json({ message: `User ${req.body.isActive ? 'activated' : 'deactivated'}` });
}));

// ─── Notifications Routes ──────────────────────────────────────────────────────
export const notificationsRouter = Router();
notificationsRouter.use(authenticate);

notificationsRouter.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { rows } = await query(
    `SELECT * FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC LIMIT 50`,
    [req.user!.id]
  );
  const unreadCount = (rows as Array<{ is_read: boolean }>).filter(r => !r.is_read).length;
  res.json({ notifications: rows, unreadCount });
}));

notificationsRouter.patch('/read-all', asyncHandler(async (req: Request, res: Response) => {
  await query(
    'UPDATE notifications SET is_read = true WHERE user_id = $1',
    [req.user!.id]
  );
  res.json({ message: 'All notifications marked as read' });
}));

notificationsRouter.patch('/:id/read', asyncHandler(async (req: Request, res: Response) => {
  await query(
    'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user!.id]
  );
  res.json({ message: 'Notification marked as read' });
}));
