import { useAuthStore } from '../store/authStore';

const BASE = '/api';

async function request<T>(
  path: string,
  opts: RequestInit = {}
): Promise<T> {
  const token = useAuthStore.getState().token;
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts.headers,
    },
  });

  if (res.status === 401) {
    useAuthStore.getState().logout();
    window.location.href = '/login';
    throw new Error('Unauthenticated');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }

  if (res.status === 204) return {} as T;
  return res.json();
}

// ─── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  getLoginUrl: () => request<{ authUrl: string }>('/auth/login'),
  getMe: () => request<import('../types').User>('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),
};

// ─── Tenants ───────────────────────────────────────────────────────────────────
export const tenantsApi = {
  list: () => request<import('../types').Tenant[]>('/tenants'),
  get: (id: string) => request<import('../types').Tenant>(`/tenants/${id}`),
  create: (data: { tenantId: string; displayName: string; clientId: string; clientSecret: string }) =>
    request<{ id: string; message: string }>('/tenants', { method: 'POST', body: JSON.stringify(data) }),
  sync: (id: string) =>
    request<{ message: string; created: number; updated: number; total: number }>(
      `/tenants/${id}/sync`, { method: 'POST' }
    ),
  deactivate: (id: string) => request(`/tenants/${id}`, { method: 'DELETE' }),
};

// ─── Policies ─────────────────────────────────────────────────────────────────
export const policiesApi = {
  list: (params?: { tenantId?: string; search?: string; state?: string; locked?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.tenantId) qs.set('tenantId', params.tenantId);
    if (params?.search) qs.set('search', params.search);
    if (params?.state) qs.set('state', params.state);
    if (params?.locked !== undefined) qs.set('locked', String(params.locked));
    return request<import('../types').CAPolicy[]>(`/policies?${qs}`);
  },
  get: (id: string) => request<import('../types').CAPolicy>(`/policies/${id}`),
  lock: (id: string) => request(`/policies/${id}/lock`, { method: 'PATCH' }),
  unlock: (id: string) => request(`/policies/${id}/unlock`, { method: 'PATCH' }),
  getDiff: (policyId: string, v1: string, v2: string) =>
    request<{ versions: import('../types').PolicyVersion[] }>(`/policies/${policyId}/diff?v1=${v1}&v2=${v2}`),
};

// ─── Change Requests ───────────────────────────────────────────────────────────
export const changeRequestsApi = {
  list: (params?: { tenantId?: string; status?: string; policyId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.tenantId) qs.set('tenantId', params.tenantId);
    if (params?.status) qs.set('status', params.status);
    if (params?.policyId) qs.set('policyId', params.policyId);
    return request<import('../types').ChangeRequest[]>(`/change-requests?${qs}`);
  },
  get: (id: string) => request<import('../types').ChangeRequest>(`/change-requests/${id}`),
  create: (data: { policyId: string; justification: string; plannedChanges?: string }) =>
    request<{ id: string; message: string }>('/change-requests', { method: 'POST', body: JSON.stringify(data) }),
  approve: (id: string, note?: string) =>
    request(`/change-requests/${id}/approve`, { method: 'POST', body: JSON.stringify({ note }) }),
  reject: (id: string, note: string) =>
    request(`/change-requests/${id}/reject`, { method: 'POST', body: JSON.stringify({ note }) }),
  complete: (id: string) =>
    request(`/change-requests/${id}/complete`, { method: 'POST' }),
  cancel: (id: string) =>
    request(`/change-requests/${id}/cancel`, { method: 'POST' }),
};

// ─── Versions ─────────────────────────────────────────────────────────────────
export const versionsApi = {
  list: (policyId: string) =>
    request<import('../types').PolicyVersion[]>(`/versions?policyId=${policyId}`),
  get: (id: string) => request<import('../types').PolicyVersion>(`/versions/${id}`),
  rollback: (versionId: string) =>
    request<{ message: string; rollbackVersionId: string }>(
      `/versions/${versionId}/rollback`, { method: 'POST' }
    ),
};

// ─── Audit ────────────────────────────────────────────────────────────────────
export const auditApi = {
  list: (params?: { tenantId?: string; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params?.tenantId) qs.set('tenantId', params.tenantId);
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.offset) qs.set('offset', String(params.offset));
    return request<{ rows: import('../types').AuditEntry[]; total: number }>(`/audit?${qs}`);
  },
  exportUrl: (tenantId?: string, format = 'csv') =>
    `/api/audit/export?format=${format}${tenantId ? `&tenantId=${tenantId}` : ''}`,
};

// ─── Users ────────────────────────────────────────────────────────────────────
export const usersApi = {
  list: () => request<import('../types').User[]>('/users'),
  setRole: (id: string, role: string) =>
    request(`/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  setStatus: (id: string, isActive: boolean) =>
    request(`/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),
};

// ─── Notifications ────────────────────────────────────────────────────────────
export const notificationsApi = {
  list: () => request<{ notifications: import('../types').Notification[]; unreadCount: number }>('/notifications'),
  readAll: () => request('/notifications/read-all', { method: 'PATCH' }),
  read: (id: string) => request(`/notifications/${id}/read`, { method: 'PATCH' }),
};
