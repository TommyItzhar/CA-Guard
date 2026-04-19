import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, GitPullRequest, CheckCircle2, AlertTriangle, Clock, TrendingUp, Lock, Unlock } from 'lucide-react';
import { policiesApi, changeRequestsApi, tenantsApi } from '../api';
import { Card, CardContent, CardHeader, CardTitle, Badge } from '../components/ui';
import { formatDistanceToNow } from 'date-fns';
import type { CAPolicy, ChangeRequest, Tenant } from '../types';

interface Stats {
  totalPolicies: number;
  lockedPolicies: number;
  unlockedPolicies: number;
  pendingRequests: number;
  activeRequests: number;
  completedToday: number;
}

export default function DashboardPage() {
  const [policies, setPolicies] = useState<CAPolicy[]>([]);
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      policiesApi.list(),
      changeRequestsApi.list(),
      tenantsApi.list(),
    ]).then(([p, r, t]) => {
      setPolicies(p);
      setRequests(r);
      setTenants(t);
    }).finally(() => setLoading(false));
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const stats: Stats = {
    totalPolicies: policies.length,
    lockedPolicies: policies.filter(p => p.is_locked).length,
    unlockedPolicies: policies.filter(p => !p.is_locked).length,
    pendingRequests: requests.filter(r => r.status === 'pending').length,
    activeRequests: requests.filter(r => ['approved','unlocked','change_detected'].includes(r.status)).length,
    completedToday: requests.filter(r => r.status === 'completed' && new Date(r.completed_at!) >= today).length,
  };

  const recentRequests = requests.slice(0, 5);

  const statCards = [
    { label: 'Total CA Policies', value: stats.totalPolicies, icon: Shield, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Locked Policies', value: stats.lockedPolicies, icon: Lock, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Unlocked Policies', value: stats.unlockedPolicies, icon: Unlock, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Pending Requests', value: stats.pendingRequests, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { label: 'Active Changes', value: stats.activeRequests, icon: GitPullRequest, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Completed Today', value: stats.completedToday, icon: CheckCircle2, color: 'text-teal-600', bg: 'bg-teal-50' },
  ];

  const statusConfig: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'secondary' | 'info' | 'purple' }> = {
    pending:        { label: 'Pending',         variant: 'warning' },
    approved:       { label: 'Approved',        variant: 'info' },
    rejected:       { label: 'Rejected',        variant: 'danger' },
    unlocked:       { label: 'Unlocked',        variant: 'warning' },
    change_detected:{ label: 'Change Detected', variant: 'purple' },
    completed:      { label: 'Completed',       variant: 'success' },
    cancelled:      { label: 'Cancelled',       variant: 'secondary' },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Shield className="h-10 w-10 text-indigo-300 mx-auto animate-pulse mb-3" />
          <p className="text-gray-500 text-sm">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Overview of your Conditional Access policy governance
        </p>
      </div>

      {/* Alert: policies unlocked */}
      {stats.unlockedPolicies > 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              {stats.unlockedPolicies} {stats.unlockedPolicies === 1 ? 'policy is' : 'policies are'} currently unlocked
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              Unlocked policies are accessible for modification. Policies auto-lock after 2 hours.
            </p>
            <Link to="/policies?locked=false" className="text-xs font-medium text-amber-700 underline mt-1 inline-block">
              View unlocked policies →
            </Link>
          </div>
        </div>
      )}

      {/* Alert: pending requests */}
      {stats.pendingRequests > 0 && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 flex items-start gap-3">
          <Clock className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-800">
              {stats.pendingRequests} change {stats.pendingRequests === 1 ? 'request requires' : 'requests require'} your approval
            </p>
            <Link to="/change-requests?status=pending" className="text-xs font-medium text-blue-700 underline mt-1 inline-block">
              Review pending requests →
            </Link>
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${bg}`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{value}</p>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent change requests */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle>Recent Change Requests</CardTitle>
              <Link to="/change-requests" className="text-xs text-indigo-600 hover:underline">View all</Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {recentRequests.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No change requests yet</p>
            ) : (
              <div className="divide-y">
                {recentRequests.map((req) => {
                  const sc = statusConfig[req.status] || { label: req.status, variant: 'secondary' as const };
                  return (
                    <Link
                      key={req.id}
                      to={`/change-requests/${req.id}`}
                      className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{req.policy_name}</p>
                        <p className="text-xs text-gray-500">by {req.requester_display_name} · {formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}</p>
                      </div>
                      <Badge variant={sc.variant}>{sc.label}</Badge>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tenant status */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle>Connected Tenants</CardTitle>
              <Link to="/tenants" className="text-xs text-indigo-600 hover:underline">Manage</Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {tenants.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-400">No tenants connected</p>
                <Link to="/tenants" className="text-xs text-indigo-600 hover:underline mt-1 block">Add a tenant →</Link>
              </div>
            ) : (
              <div className="divide-y">
                {tenants.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 px-6 py-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100">
                      <TrendingUp className="h-4 w-4 text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{t.display_name}</p>
                      <p className="text-xs text-gray-400">
                        {t.last_sync
                          ? `Synced ${formatDistanceToNow(new Date(t.last_sync), { addSuffix: true })}`
                          : 'Never synced'}
                      </p>
                    </div>
                    <Badge variant={t.sync_status === 'success' ? 'success' : t.sync_status === 'error' ? 'danger' : 'secondary'}>
                      {t.sync_status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
