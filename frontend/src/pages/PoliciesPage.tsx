import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Shield, Lock, Unlock, Search, RefreshCw, ChevronRight, AlertTriangle } from 'lucide-react';
import { policiesApi, tenantsApi } from '../api';
import { Badge, Input, Select, Button } from '../components/ui';
import { useAuthStore } from '../store/authStore';
import { formatDistanceToNow } from 'date-fns';
import type { CAPolicy, Tenant } from '../types';
import { cn } from '../utils/cn';

const stateConfig: Record<string, { label: string; variant: 'success' | 'secondary' | 'warning' }> = {
  enabled: { label: 'Enabled', variant: 'success' },
  disabled: { label: 'Disabled', variant: 'secondary' },
  enabledForReportingButNotEnforced: { label: 'Report Only', variant: 'warning' },
};

export default function PoliciesPage() {
  const user = useAuthStore(s => s.user);
  const [searchParams, setSearchParams] = useSearchParams();
  const [policies, setPolicies] = useState<CAPolicy[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const tenantFilter = searchParams.get('tenantId') || '';
  const lockedFilter = searchParams.get('locked') || '';

  useEffect(() => { tenantsApi.list().then(setTenants).catch(() => {}); }, []);

  useEffect(() => {
    setLoading(true);
    policiesApi.list({
      tenantId: tenantFilter || undefined,
      search: search || undefined,
      locked: lockedFilter === '' ? undefined : lockedFilter === 'true',
    }).then(setPolicies).finally(() => setLoading(false));
  }, [tenantFilter, lockedFilter, search]);

  const canAdmin = user?.role === 'super_admin' || user?.role === 'ca_admin';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CA Policies</h1>
          <p className="text-sm text-gray-500 mt-1">{policies.length} policies</p>
        </div>
        {canAdmin && (
          <Link to="/tenants">
            <Button variant="outline" size="sm">
              <RefreshCw className="h-4 w-4" /> Sync Tenant
            </Button>
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search policies..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={tenantFilter}
          onChange={e => setSearchParams(p => { if (e.target.value) { p.set('tenantId', e.target.value); } else { p.delete('tenantId'); } return p; })}
          className="w-52"
        >
          <option value="">All tenants</option>
          {tenants.map(t => <option key={t.id} value={t.id}>{t.display_name}</option>)}
        </Select>
        <Select
          value={lockedFilter}
          onChange={e => setSearchParams(p => { if (e.target.value) { p.set('locked', e.target.value); } else { p.delete('locked'); } return p; })}
          className="w-44"
        >
          <option value="">All policies</option>
          <option value="true">Locked only</option>
          <option value="false">Unlocked only</option>
        </Select>
      </div>

      {/* Policy grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-lg border bg-white p-5 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : policies.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border">
          <Shield className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No policies found</p>
          <p className="text-sm text-gray-400 mt-1">Try adjusting your filters or sync a tenant</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {policies.map(policy => {
            const sc = stateConfig[policy.state] || { label: policy.state, variant: 'secondary' as const };
            return (
              <Link
                key={policy.id}
                to={`/policies/${policy.id}`}
                className={cn(
                  'group relative rounded-lg border bg-white p-5 shadow-sm hover:shadow-md transition-all hover:border-indigo-200',
                  !policy.is_locked && 'border-amber-200 bg-amber-50/30',
                  'policy-locked'
                )}
              >
                {/* Lock status indicator */}
                <div className="flex items-start justify-between mb-3">
                  <div className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg shrink-0',
                    policy.is_locked ? 'bg-green-50' : 'bg-amber-50'
                  )}>
                    {policy.is_locked
                      ? <Lock className="h-4 w-4 text-green-600" />
                      : <Unlock className="h-4 w-4 text-amber-600" />
                    }
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant={sc.variant}>{sc.label}</Badge>
                    <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-indigo-400 transition-colors" />
                  </div>
                </div>

                {/* Policy name */}
                <p className="font-medium text-gray-900 text-sm leading-snug mb-1 line-clamp-2">
                  {policy.display_name}
                </p>
                <p className="text-xs text-gray-400 mb-3">{policy.tenant_name}</p>

                {/* Unlocked warning */}
                {!policy.is_locked && (
                  <div className="flex items-center gap-1.5 mb-3 text-xs text-amber-700">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>Unlocked for changes</span>
                  </div>
                )}

                {/* Meta */}
                <div className="flex items-center gap-3 text-xs text-gray-400 border-t pt-3 mt-1">
                  <span>{policy.version_count} versions</span>
                  {policy.active_requests > 0 && (
                    <span className="text-amber-600 font-medium">{policy.active_requests} active request</span>
                  )}
                  <span className="ml-auto">{formatDistanceToNow(new Date(policy.updated_at), { addSuffix: true })}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
