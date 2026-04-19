import { useEffect, useState } from 'react';
import { ClipboardList, Download } from 'lucide-react';
import { auditApi, tenantsApi } from '../api';
import { Card, Badge, Button, Select } from '../components/ui';
import { format } from 'date-fns';
import type { AuditEntry, Tenant } from '../types';

const actionColors: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'secondary' | 'purple'> = {
  'user.login': 'success',
  'tenant.created': 'info',
  'tenant.synced': 'info',
  'policy.locked': 'success',
  'policy.unlocked': 'warning',
  'policy.rolled_back': 'purple',
  'policy.auto_locked': 'secondary',
  'policy.change_detected': 'warning',
  'change_request.created': 'info',
  'change_request.approved': 'success',
  'change_request.rejected': 'danger',
  'change_request.completed': 'success',
};

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantFilter, setTenantFilter] = useState('');
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const LIMIT = 50;

  useEffect(() => { tenantsApi.list().then(setTenants).catch(() => {}); }, []);

  useEffect(() => {
    setLoading(true);
    auditApi.list({ tenantId: tenantFilter || undefined, limit: LIMIT, offset })
      .then(r => { setEntries(r.rows); setTotal(r.total); })
      .finally(() => setLoading(false));
  }, [tenantFilter, offset]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
          <p className="text-sm text-gray-500 mt-1">{total} total entries</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={tenantFilter} onChange={e => { setTenantFilter(e.target.value); setOffset(0); }} className="w-52">
            <option value="">All tenants</option>
            {tenants.map(t => <option key={t.id} value={t.id}>{t.display_name}</option>)}
          </Select>
          <a href={auditApi.exportUrl(tenantFilter || undefined, 'csv')} download>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </a>
        </div>
      </div>

      <Card>
        {loading ? (
          <div className="text-center py-10 text-gray-400">Loading audit log...</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16">
            <ClipboardList className="h-12 w-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500">No audit entries found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  {['Time', 'User', 'Action', 'Resource', 'IP'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {entries.map(e => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {format(new Date(e.created_at), 'MMM d, HH:mm:ss')}
                    </td>
                    <td className="px-4 py-3 text-gray-900 whitespace-nowrap">{e.user_name || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge variant={actionColors[e.action] || 'secondary'} className="font-mono text-xs">
                        {e.action}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{e.resource_name || e.resource_id || '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs font-mono">{e.ip_address || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Pagination */}
      {total > LIMIT && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Showing {offset + 1}–{Math.min(offset + LIMIT, total)} of {total}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(o => Math.max(0, o - LIMIT))}>Previous</Button>
            <Button variant="outline" size="sm" disabled={offset + LIMIT >= total} onClick={() => setOffset(o => o + LIMIT)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
