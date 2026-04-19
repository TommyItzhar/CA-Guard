import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { GitPullRequest, ChevronRight, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { changeRequestsApi } from '../api';
import { Card, Badge, Select } from '../components/ui';
import { formatDistanceToNow } from 'date-fns';
import type { ChangeRequest, ChangeRequestStatus } from '../types';

const statusConfig: Record<ChangeRequestStatus, { label: string; variant: 'warning' | 'info' | 'danger' | 'purple' | 'success' | 'secondary' }> = {
  pending:         { label: 'Pending Review',   variant: 'warning' },
  approved:        { label: 'Approved',          variant: 'info' },
  rejected:        { label: 'Rejected',          variant: 'danger' },
  unlocked:        { label: 'Unlocked',          variant: 'warning' },
  change_detected: { label: 'Change Detected',   variant: 'purple' },
  completed:       { label: 'Completed',         variant: 'success' },
  cancelled:       { label: 'Cancelled',         variant: 'secondary' },
};

const statusIcon: Record<ChangeRequestStatus, typeof Clock> = {
  pending: Clock, approved: CheckCircle2, rejected: XCircle,
  unlocked: CheckCircle2, change_detected: GitPullRequest,
  completed: CheckCircle2, cancelled: XCircle,
};

export default function ChangeRequestsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const statusFilter = searchParams.get('status') || '';

  useEffect(() => {
    setLoading(true);
    changeRequestsApi.list({ status: statusFilter || undefined })
      .then(setRequests)
      .finally(() => setLoading(false));
  }, [statusFilter]);

  const statusCounts = requests.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Change Requests</h1>
          <p className="text-sm text-gray-500 mt-1">{requests.length} requests</p>
        </div>
        <Select
          value={statusFilter}
          onChange={e => setSearchParams(p => { e.target.value ? p.set('status', e.target.value) : p.delete('status'); return p; })}
          className="w-52"
        >
          <option value="">All statuses</option>
          {(Object.keys(statusConfig) as ChangeRequestStatus[]).map(s => (
            <option key={s} value={s}>{statusConfig[s].label}{statusCounts[s] ? ` (${statusCounts[s]})` : ''}</option>
          ))}
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-lg border bg-white p-5 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border">
          <GitPullRequest className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No change requests found</p>
          <p className="text-sm text-gray-400 mt-1">
            {statusFilter ? 'No requests with this status' : 'Submit a change request from a policy page'}
          </p>
        </div>
      ) : (
        <Card>
          <div className="divide-y">
            {requests.map(req => {
              const sc = statusConfig[req.status];
              const Icon = statusIcon[req.status] || GitPullRequest;
              return (
                <Link
                  key={req.id}
                  to={`/change-requests/${req.id}`}
                  className="flex items-center gap-4 p-5 hover:bg-gray-50 transition-colors group"
                >
                  <div className={`flex h-9 w-9 items-center justify-center rounded-full shrink-0 ${
                    req.status === 'pending' ? 'bg-yellow-50' :
                    req.status === 'completed' ? 'bg-green-50' :
                    req.status === 'rejected' ? 'bg-red-50' : 'bg-blue-50'
                  }`}>
                    <Icon className={`h-4 w-4 ${
                      req.status === 'pending' ? 'text-yellow-600' :
                      req.status === 'completed' ? 'text-green-600' :
                      req.status === 'rejected' ? 'text-red-600' : 'text-blue-600'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{req.policy_name}</p>
                    <p className="text-sm text-gray-500 mt-0.5 truncate">{req.justification}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      by {req.requester_display_name} · {formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}
                      {req.tenant_name && <> · {req.tenant_name}</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge variant={sc.variant}>{sc.label}</Badge>
                    <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-indigo-400 transition-colors" />
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
