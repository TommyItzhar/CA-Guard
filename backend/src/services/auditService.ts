import { query } from '../utils/db';
import { logger } from '../utils/logger';

export interface AuditEntry {
  tenantId?: string;
  userId?: string;
  userName?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  resourceName?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export async function audit(entry: AuditEntry): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_log
         (tenant_id, user_id, user_name, action, resource_type, resource_id,
          resource_name, details, ip_address, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        entry.tenantId ?? null,
        entry.userId ?? null,
        entry.userName ?? null,
        entry.action,
        entry.resourceType ?? null,
        entry.resourceId ?? null,
        entry.resourceName ?? null,
        entry.details ? JSON.stringify(entry.details) : null,
        entry.ipAddress ?? null,
        entry.userAgent ?? null,
      ]
    );
  } catch (err) {
    logger.error('Failed to write audit log', { entry, err });
  }
}

export async function getAuditLog(opts: {
  tenantId?: string;
  userId?: string;
  action?: string;
  limit?: number;
  offset?: number;
}): Promise<{ rows: unknown[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (opts.tenantId) { conditions.push(`al.tenant_id = $${i++}`); params.push(opts.tenantId); }
  if (opts.userId) { conditions.push(`al.user_id = $${i++}`); params.push(opts.userId); }
  if (opts.action) { conditions.push(`al.action ILIKE $${i++}`); params.push(`%${opts.action}%`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;

  const [dataResult, countResult] = await Promise.all([
    query(
      `SELECT al.*, t.display_name as tenant_name
       FROM audit_log al
       LEFT JOIN tenants t ON t.id = al.tenant_id
       ${where}
       ORDER BY al.created_at DESC
       LIMIT $${i++} OFFSET $${i}`,
      [...params, limit, offset]
    ),
    query(`SELECT COUNT(*) as count FROM audit_log al ${where}`, params),
  ]);

  return {
    rows: dataResult.rows,
    total: Number((countResult.rows[0] as { count: string }).count),
  };
}
