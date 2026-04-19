import { useCallback, useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Lock, Unlock, GitPullRequest, History, ChevronLeft,
  RotateCcw, AlertTriangle, Clock, Eye
} from 'lucide-react';
import { policiesApi, changeRequestsApi, versionsApi } from '../api';
import {
  Card, CardHeader, CardTitle, CardContent, Button, Badge,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Textarea, Label
} from '../components/ui';
import { useAuthStore } from '../store/authStore';
import { toast } from '../components/ui/toaster';
import { formatDistanceToNow, format } from 'date-fns';
import type { CAPolicy, PolicyVersion, ChangeRequest } from '../types';
import { cn } from '../utils/cn';

const changeTypeConfig: Record<string, { label: string; color: string }> = {
  initial:     { label: 'Initial import',   color: 'bg-gray-100 text-gray-700' },
  pre_change:  { label: 'Pre-change backup', color: 'bg-blue-100 text-blue-700' },
  post_change: { label: 'Post-change',       color: 'bg-purple-100 text-purple-700' },
  rollback:    { label: 'Rollback',          color: 'bg-amber-100 text-amber-700' },
  sync:        { label: 'Sync',              color: 'bg-gray-100 text-gray-600' },
};

export default function PolicyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const [policy, setPolicy] = useState<CAPolicy | null>(null);
  const [versions, setVersions] = useState<PolicyVersion[]>([]);
  const [activeRequests, setActiveRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showRollbackModal, setShowRollbackModal] = useState<PolicyVersion | null>(null);
  const [justification, setJustification] = useState('');
  const [plannedChanges, setPlannedChanges] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  const canAdmin = user?.role === 'super_admin' || user?.role === 'ca_admin';
  const canRequest = ['super_admin', 'ca_admin', 'azure_admin'].includes(user?.role || '');

  const loadData = useCallback(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      policiesApi.get(id),
      versionsApi.list(id),
      changeRequestsApi.list({ policyId: id }),
    ]).then(([p, v, r]) => {
      setPolicy(p);
      setVersions(v);
      setActiveRequests(r.filter(req => !['completed','rejected','cancelled'].includes(req.status)));
    }).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleSubmitRequest() {
    if (!id || !justification.trim()) return;
    setSubmitting(true);
    try {
      const res = await changeRequestsApi.create({ policyId: id, justification, plannedChanges });
      toast({ title: 'Change request submitted', description: 'Admins will be notified.', variant: 'success' });
      setShowRequestModal(false);
      setJustification('');
      setPlannedChanges('');
      navigate(`/change-requests/${res.id}`);
    } catch (e: unknown) {
      toast({ title: 'Failed to submit request', description: e instanceof Error ? e.message : 'Unknown error', variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRollback(version: PolicyVersion) {
    setSubmitting(true);
    try {
      await versionsApi.rollback(version.id);
      toast({ title: `Rolled back to v${version.version_number}`, variant: 'success' });
      setShowRollbackModal(null);
      loadData();
    } catch (e: unknown) {
      toast({ title: 'Rollback failed', description: e instanceof Error ? e.message : 'Unknown error', variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
    </div>
  );

  if (!policy) return (
    <div className="text-center py-16">
      <p className="text-gray-500">Policy not found</p>
      <Link to="/policies" className="text-indigo-600 text-sm hover:underline mt-2 block">Back to policies</Link>
    </div>
  );

  const pd = policy.policy_data;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/policies" className="hover:text-indigo-600 flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" />Policies
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium truncate">{policy.display_name}</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start gap-4 justify-between">
        <div className="flex items-start gap-3">
          <div className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg shrink-0 mt-0.5',
            policy.is_locked ? 'bg-green-50' : 'bg-amber-50'
          )}>
            {policy.is_locked
              ? <Lock className="h-5 w-5 text-green-600" />
              : <Unlock className="h-5 w-5 text-amber-600" />
            }
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{policy.display_name}</h1>
            <p className="text-sm text-gray-500">{policy.tenant_name} · {policy.azure_policy_id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={policy.state === 'enabled' ? 'success' : policy.state === 'disabled' ? 'secondary' : 'warning'}>
            {policy.state === 'enabled' ? 'Enabled' : policy.state === 'disabled' ? 'Disabled' : 'Report Only'}
          </Badge>
          <Badge variant={policy.is_locked ? 'success' : 'warning'}>
            {policy.is_locked ? 'Locked' : 'Unlocked'}
          </Badge>
          {canRequest && policy.is_locked && activeRequests.length === 0 && (
            <Button size="sm" onClick={() => setShowRequestModal(true)}>
              <GitPullRequest className="h-4 w-4" />
              Request Change
            </Button>
          )}
          {activeRequests.length > 0 && (
            <Link to={`/change-requests/${activeRequests[0].id}`}>
              <Button variant="outline" size="sm">
                <Clock className="h-4 w-4" />
                View Active Request
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Unlocked warning */}
      {!policy.is_locked && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">This policy is currently unlocked</p>
            <p className="text-xs text-amber-600 mt-0.5">Changes may be applied in Azure. The policy will auto-lock after 2 hours.</p>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Policy data */}
        <div className="lg:col-span-2 space-y-4">
          {/* Conditions */}
          <Card>
            <CardHeader><CardTitle>Conditions</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {pd?.conditions?.users && (
                <div>
                  <p className="font-medium text-gray-700 mb-1">Users & Groups</p>
                  {pd.conditions.users.includeUsers?.length ? (
                    <p className="text-gray-600">Include users: <code className="bg-gray-100 px-1 rounded text-xs">{pd.conditions.users.includeUsers.join(', ')}</code></p>
                  ) : null}
                  {pd.conditions.users.includeGroups?.length ? (
                    <p className="text-gray-600 mt-1">Include groups: {pd.conditions.users.includeGroups.length} group(s)</p>
                  ) : null}
                  {pd.conditions.users.excludeUsers?.length ? (
                    <p className="text-gray-600 mt-1">Exclude: {pd.conditions.users.excludeUsers.length} user(s)</p>
                  ) : null}
                </div>
              )}
              {pd?.conditions?.applications && (
                <div>
                  <p className="font-medium text-gray-700 mb-1">Applications</p>
                  {pd.conditions.applications.includeApplications?.map(a => (
                    <span key={a} className="inline-block bg-indigo-50 text-indigo-700 rounded px-2 py-0.5 text-xs mr-1 mb-1">{a}</span>
                  ))}
                </div>
              )}
              {pd?.conditions?.platforms && (
                <div>
                  <p className="font-medium text-gray-700 mb-1">Platforms</p>
                  {pd.conditions.platforms.includePlatforms?.map(p => (
                    <span key={p} className="inline-block bg-gray-100 text-gray-700 rounded px-2 py-0.5 text-xs mr-1 mb-1">{p}</span>
                  ))}
                </div>
              )}
              {pd?.conditions?.signInRiskLevels?.length ? (
                <div>
                  <p className="font-medium text-gray-700 mb-1">Sign-in Risk</p>
                  {pd.conditions.signInRiskLevels.map(r => (
                    <span key={r} className="inline-block bg-red-50 text-red-700 rounded px-2 py-0.5 text-xs mr-1">{r}</span>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Grant controls */}
          <Card>
            <CardHeader><CardTitle>Grant Controls</CardTitle></CardHeader>
            <CardContent className="text-sm">
              {pd?.grantControls ? (
                <div className="space-y-2">
                  <p className="text-gray-600">
                    Operator: <Badge variant="secondary">{pd.grantControls.operator}</Badge>
                  </p>
                  {pd.grantControls.builtInControls?.length ? (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {pd.grantControls.builtInControls.map(c => (
                        <span key={c} className="bg-green-50 text-green-700 rounded px-2 py-0.5 text-xs">{c}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-gray-400">Block access (no grant controls)</p>
              )}
            </CardContent>
          </Card>

          {/* Raw JSON */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Full Policy JSON</CardTitle>
                <button
                  onClick={() => setSelectedVersionId(selectedVersionId ? null : 'raw')}
                  className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
                >
                  <Eye className="h-3.5 w-3.5" />
                  {selectedVersionId ? 'Hide' : 'Show'}
                </button>
              </div>
            </CardHeader>
            {selectedVersionId && (
              <CardContent>
                <pre className="bg-gray-50 rounded-lg p-4 text-xs overflow-auto max-h-96 border">
                  {JSON.stringify(pd, null, 2)}
                </pre>
              </CardContent>
            )}
          </Card>
        </div>

        {/* Version history sidebar */}
        <div>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Version History
                </CardTitle>
                <span className="text-xs text-gray-400">{versions.length} versions</span>
              </div>
            </CardHeader>
            <CardContent className="p-0 max-h-[600px] overflow-y-auto">
              {versions.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No versions yet</p>
              ) : (
                <div className="divide-y">
                  {versions.map((v) => {
                    const ctc = changeTypeConfig[v.change_type] || { label: v.change_type, color: 'bg-gray-100 text-gray-600' };
                    return (
                      <div key={v.id} className="p-4 hover:bg-gray-50">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-900">v{v.version_number}</span>
                          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', ctc.color)}>
                            {ctc.label}
                          </span>
                        </div>
                        {v.change_summary && (
                          <p className="text-xs text-gray-500 mb-1 line-clamp-2">{v.change_summary}</p>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-xs text-gray-400">
                            {v.created_by_name || 'System'} · {formatDistanceToNow(new Date(v.created_at), { addSuffix: true })}
                          </p>
                          {canAdmin && v.change_type !== 'sync' && (
                            <button
                              onClick={() => setShowRollbackModal(v)}
                              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                            >
                              <RotateCcw className="h-3 w-3" />
                              Restore
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Change Request Modal */}
      <Dialog open={showRequestModal} onOpenChange={setShowRequestModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Policy Change</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 mb-1">
            Policy: <span className="font-medium">{policy.display_name}</span>
          </p>
          <div className="space-y-4">
            <div>
              <Label htmlFor="justification">Justification <span className="text-red-500">*</span></Label>
              <Textarea
                id="justification"
                value={justification}
                onChange={e => setJustification(e.target.value)}
                placeholder="Describe why this policy needs to be changed..."
                className="mt-1 h-24"
              />
            </div>
            <div>
              <Label htmlFor="planned">Planned Changes (optional)</Label>
              <Textarea
                id="planned"
                value={plannedChanges}
                onChange={e => setPlannedChanges(e.target.value)}
                placeholder="Describe what changes you plan to make..."
                className="mt-1 h-20"
              />
            </div>
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-700">
              <p className="font-medium mb-0.5">What happens next:</p>
              <ol className="list-decimal list-inside space-y-0.5 text-blue-600">
                <li>A CA admin will review and approve or reject your request</li>
                <li>If approved, the policy will be temporarily unlocked for 2 hours</li>
                <li>After your change, admins will review and re-lock the policy</li>
              </ol>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRequestModal(false)}>Cancel</Button>
            <Button onClick={handleSubmitRequest} loading={submitting} disabled={!justification.trim()}>
              <GitPullRequest className="h-4 w-4" />
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rollback Confirmation Modal */}
      {showRollbackModal && (
        <Dialog open={!!showRollbackModal} onOpenChange={() => setShowRollbackModal(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Rollback</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-700">
                  This will immediately apply version <strong>v{showRollbackModal.version_number}</strong> to
                  the Azure tenant and re-lock the policy. This action cannot be undone without another rollback.
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <p className="text-gray-600">Restoring to:</p>
                <p className="font-medium text-gray-900 mt-0.5">v{showRollbackModal.version_number} — {showRollbackModal.change_summary}</p>
                <p className="text-xs text-gray-400 mt-1">
                  Created {format(new Date(showRollbackModal.created_at), 'MMM d, yyyy HH:mm')} by {showRollbackModal.created_by_name || 'System'}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRollbackModal(null)}>Cancel</Button>
              <Button variant="warning" onClick={() => handleRollback(showRollbackModal)} loading={submitting}>
                <RotateCcw className="h-4 w-4" />
                Confirm Rollback
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
