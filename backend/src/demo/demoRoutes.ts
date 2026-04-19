import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import {
  demoTenant, demoUsers, demoPolicies, demoVersions,
  demoChangeRequests, demoAuditLog,
  DEMO_USER_ID, DEMO_ADMIN_ID,
} from './demoData';
import type { DemoVersion } from './demoData';

type DemoPolicy = typeof demoPolicies[number] & { active_requests: number };
type DemoChangeRequest = typeof demoChangeRequests[number] & Record<string, unknown>;

interface DemoNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  reference_id: string;
  reference_type: string;
  created_at: string;
}

const router = Router();

// ─── In-memory state (resets on server restart) ───────────────────────────────
const policies: DemoPolicy[] = JSON.parse(JSON.stringify(demoPolicies)) as DemoPolicy[];
const changeRequests: DemoChangeRequest[] = JSON.parse(JSON.stringify(demoChangeRequests)) as DemoChangeRequest[];
const versions: Record<string, DemoVersion[]> = JSON.parse(JSON.stringify(demoVersions)) as Record<string, DemoVersion[]>;
const notifications: DemoNotification[] = [
  { id: 'notif-001', type: 'change_request', title: 'New change request pending', message: 'Jordan Azure requested access to modify "Named Locations — Trusted Countries Only"', is_read: false, reference_id: 'req-001', reference_type: 'change_request', created_at: new Date(Date.now() - 2 * 3600000).toISOString() },
];

// ─── Demo login ───────────────────────────────────────────────────────────────
router.get('/auth/login', (_req: Request, res: Response) => {
  res.json({ authUrl: '/api/auth/instant-login?role=ca_admin' });
});

router.get('/auth/instant-login', (req: Request, res: Response) => {
  const role = (req.query.role as string) || 'ca_admin';
  const user = demoUsers.find(u => u.role === role) || demoUsers[1];
  const token = jwt.sign(
    { id: user.id, azure_oid: user.azure_oid, display_name: user.display_name, email: user.email, role: user.role },
    process.env.JWT_SECRET || 'demo-secret-key',
    { expiresIn: '24h' }
  );
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  res.redirect(`${frontendUrl}/auth/callback?token=${token}&redirect=/dashboard`);
});

router.get('/auth/me', (_req: Request, res: Response) => {
  res.json(demoUsers[1]);
});

// ─── Tenants ──────────────────────────────────────────────────────────────────
router.get('/tenants', (_req: Request, res: Response) => res.json([demoTenant]));
router.get('/tenants/:id', (_req: Request, res: Response) => res.json(demoTenant));
router.post('/tenants/:id/sync', (_req: Request, res: Response) => {
  res.json({ message: 'Demo sync complete', created: 0, updated: 10, total: 10 });
});

// ─── Policies ─────────────────────────────────────────────────────────────────
router.get('/policies', (req: Request, res: Response) => {
  let result = [...policies];
  const { search, state, locked, tenantId } = req.query as Record<string, string>;
  if (search) result = result.filter(p => p.display_name.toLowerCase().includes(search.toLowerCase()));
  if (state) result = result.filter(p => p.state === state);
  if (locked !== undefined) result = result.filter(p => p.is_locked === (locked === 'true'));
  if (tenantId && tenantId !== demoTenant.id) result = [];
  res.json(result);
});

router.get('/policies/:id', (req: Request, res: Response) => {
  const policy = policies.find(p => p.id === req.params.id);
  if (!policy) return res.status(404).json({ error: 'Policy not found' });
  res.json(policy);
});

router.patch('/policies/:id/lock', (req: Request, res: Response) => {
  const policy = policies.find(p => p.id === req.params.id);
  if (policy) { policy.is_locked = true; policy.updated_at = new Date().toISOString(); }
  res.json({ message: 'Policy locked (demo)' });
});

router.patch('/policies/:id/unlock', (req: Request, res: Response) => {
  const policy = policies.find(p => p.id === req.params.id);
  if (policy) { policy.is_locked = false; policy.updated_at = new Date().toISOString(); }
  res.json({ message: 'Policy unlocked (demo)' });
});

router.get('/policies/:id/diff', (req: Request, res: Response) => {
  const pVersions = versions[req.params.id] || [];
  res.json({ versions: pVersions.slice(0, 2) });
});

// ─── Change Requests ──────────────────────────────────────────────────────────
router.get('/change-requests', (req: Request, res: Response) => {
  let result = [...changeRequests];
  const { status, policyId } = req.query as Record<string, string>;
  if (status) result = result.filter(r => r.status === status);
  if (policyId) result = result.filter(r => r.policy_id === policyId);
  res.json(result);
});

router.get('/change-requests/:id', (req: Request, res: Response) => {
  const cr = changeRequests.find(r => r.id === req.params.id);
  if (!cr) return res.status(404).json({ error: 'Not found' });
  res.json(cr);
});

router.post('/change-requests', (req: Request, res: Response) => {
  const { policyId, justification, plannedChanges } = req.body;
  const policy = policies.find(p => p.id === policyId);
  if (!policy) return res.status(404).json({ error: 'Policy not found' });

  const newReq = {
    id: `req-demo-${Date.now()}`,
    tenant_id: demoTenant.id,
    tenant_name: demoTenant.display_name,
    policy_id: policyId,
    azure_policy_id: policy.azure_policy_id,
    policy_name: policy.display_name,
    requester_id: DEMO_USER_ID,
    requester_name: 'Demo User',
    requester_display_name: 'Demo User',
    status: 'pending',
    justification,
    planned_changes: plannedChanges || null,
    approver_id: null, approver_name: null, approver_display_name: null,
    approval_note: null, approved_at: null, unlocked_at: null,
    lock_expires_at: null, change_detected_at: null, completed_at: null,
    pre_change_version_id: null, post_change_version_id: null,
    pre_version_number: null, post_version_number: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  changeRequests.unshift(newReq);
  policy.active_requests = (policy.active_requests || 0) + 1;
  notifications.unshift({ id: `notif-${Date.now()}`, type: 'change_request', title: 'New change request', message: `Demo User requested changes to "${policy.display_name}"`, is_read: false, reference_id: newReq.id, reference_type: 'change_request', created_at: new Date().toISOString() });
  res.status(201).json({ id: newReq.id, message: 'Change request submitted (demo)' });
});

router.post('/change-requests/:id/approve', (req: Request, res: Response) => {
  const cr = changeRequests.find(r => r.id === req.params.id);
  if (!cr || cr.status !== 'pending') return res.status(404).json({ error: 'Pending request not found' });
  const policy = policies.find(p => p.id === cr.policy_id);

  cr.status = 'approved';
  cr.approver_id = DEMO_ADMIN_ID;
  cr.approver_name = 'Alex Admin';
  cr.approver_display_name = 'Alex Admin';
  cr.approval_note = req.body.note || null;
  cr.approved_at = new Date().toISOString();
  cr.unlocked_at = new Date().toISOString();
  cr.lock_expires_at = new Date(Date.now() + 2 * 3600000).toISOString();
  cr.pre_version_number = (versions[cr.policy_id]?.length || 0) + 1;
  cr.updated_at = new Date().toISOString();

  if (policy) policy.is_locked = false;
  res.json({ message: 'Request approved. Policy unlocked for 2 hours. (demo)' });
});

router.post('/change-requests/:id/reject', (req: Request, res: Response) => {
  const cr = changeRequests.find(r => r.id === req.params.id);
  if (!cr || cr.status !== 'pending') return res.status(404).json({ error: 'Pending request not found' });
  cr.status = 'rejected';
  cr.approver_id = DEMO_ADMIN_ID;
  cr.approver_name = 'Alex Admin';
  cr.approver_display_name = 'Alex Admin';
  cr.approval_note = req.body.note;
  cr.approved_at = new Date().toISOString();
  cr.updated_at = new Date().toISOString();
  const policy = policies.find(p => p.id === cr.policy_id);
  if (policy) policy.active_requests = Math.max(0, (policy.active_requests || 1) - 1);
  res.json({ message: 'Request rejected (demo)' });
});

router.post('/change-requests/:id/complete', (req: Request, res: Response) => {
  const cr = changeRequests.find(r => r.id === req.params.id);
  if (!cr) return res.status(404).json({ error: 'Not found' });
  cr.status = 'completed';
  cr.completed_at = new Date().toISOString();
  cr.post_version_number = (cr.pre_version_number || 1) + 1;
  cr.updated_at = new Date().toISOString();
  const policy = policies.find(p => p.id === cr.policy_id);
  if (policy) { policy.is_locked = true; policy.active_requests = Math.max(0, (policy.active_requests || 1) - 1); }
  res.json({ message: 'Change completed and policy re-locked (demo)' });
});

router.post('/change-requests/:id/cancel', (req: Request, res: Response) => {
  const cr = changeRequests.find(r => r.id === req.params.id);
  if (!cr) return res.status(404).json({ error: 'Not found' });
  cr.status = 'cancelled';
  cr.updated_at = new Date().toISOString();
  res.json({ message: 'Cancelled (demo)' });
});

// ─── Versions ─────────────────────────────────────────────────────────────────
router.get('/versions', (req: Request, res: Response) => {
  const { policyId } = req.query as { policyId: string };
  res.json(versions[policyId] || []);
});

router.get('/versions/:id', (req: Request, res: Response) => {
  for (const vList of Object.values(versions)) {
    const v = vList.find(v => v.id === req.params.id);
    if (v) return res.json(v);
  }
  res.status(404).json({ error: 'Version not found' });
});

router.post('/versions/:id/rollback', (req: Request, res: Response) => {
  let targetVersion: DemoVersion | null = null;
  let targetPolicyId = '';
  for (const [pId, vList] of Object.entries(versions)) {
    const v = vList.find(v => v.id === req.params.id);
    if (v) { targetVersion = v; targetPolicyId = pId; break; }
  }
  if (!targetVersion) return res.status(404).json({ error: 'Version not found' });

  const policy = policies.find(p => p.id === targetPolicyId);
  if (policy) {
    policy.is_locked = true;
    policy.policy_data = targetVersion.policy_data;
    policy.updated_at = new Date().toISOString();
  }

  const newVersion = { ...targetVersion, id: `ver-rollback-${Date.now()}`, version_number: (versions[targetPolicyId]?.length || 0) + 1, change_type: 'rollback', change_summary: `Rolled back to v${targetVersion.version_number} (demo)`, created_at: new Date().toISOString(), created_by_name: 'Demo User' };
  versions[targetPolicyId] = [...(versions[targetPolicyId] || []), newVersion];

  res.json({ message: `Rolled back to v${targetVersion.version_number} (demo)`, rollbackVersionId: newVersion.id });
});

// ─── Audit ────────────────────────────────────────────────────────────────────
router.get('/audit', (_req: Request, res: Response) => {
  res.json({ rows: demoAuditLog, total: demoAuditLog.length });
});

// ─── Users ────────────────────────────────────────────────────────────────────
router.get('/users', (_req: Request, res: Response) => res.json(demoUsers));
router.patch('/users/:id/role', (req: Request, res: Response) => res.json({ message: 'Role updated (demo)' }));
router.patch('/users/:id/status', (req: Request, res: Response) => res.json({ message: 'Status updated (demo)' }));

// ─── Notifications ────────────────────────────────────────────────────────────
router.get('/notifications', (_req: Request, res: Response) => {
  res.json({ notifications, unreadCount: notifications.filter(n => !n.is_read).length });
});
router.patch('/notifications/read-all', (_req: Request, res: Response) => {
  notifications.forEach(n => n.is_read = true);
  res.json({ message: 'All read (demo)' });
});
router.patch('/notifications/:id/read', (req: Request, res: Response) => {
  const n = notifications.find(n => n.id === req.params.id);
  if (n) n.is_read = true;
  res.json({ message: 'Read (demo)' });
});

// ─── Auth logout ──────────────────────────────────────────────────────────────
router.post('/auth/logout', (_req: Request, res: Response) => res.json({ message: 'Logged out (demo)' }));

export default router;
