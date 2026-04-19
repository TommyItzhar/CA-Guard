import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, CheckCircle2, XCircle, Clock, Shield,
  Unlock, AlertTriangle, RotateCcw, User, CalendarDays
} from 'lucide-react';
import { changeRequestsApi } from '../api';
import {
  Card, CardHeader, CardTitle, CardContent, Button, Badge,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Textarea, Label
} from '../components/ui';
import { useAuthStore } from '../store/authStore';
import { toast } from '../components/ui/toaster';
import { format, formatDistanceToNow } from 'date-fns';
import type { ChangeRequest, ChangeRequestStatus } from '../types';

const statusConfig: Record<ChangeRequestStatus, { label: string; variant: 'warning' | 'info' | 'danger' | 'purple' | 'success' | 'secondary'; description: string }> = {
  pending:         { label: 'Pending Review',   variant: 'warning', description: 'Awaiting admin approval' },
  approved:        { label: 'Approved',         variant: 'info',    description: 'Policy unlocked — changes can be applied in Azure' },
  rejected:        { label: 'Rejected',         variant: 'danger',  description: 'Request was rejected by an administrator' },
  unlocked:        { label: 'Unlocked',         variant: 'warning', description: 'Policy is unlocked and ready for changes' },
  change_detected: { label: 'Change Detected',  variant: 'purple',  description: 'A change was detected — awaiting admin review' },
  completed:       { label: 'Completed',        variant: 'success', description: 'Changes reviewed and policy re-locked' },
  cancelled:       { label: 'Cancelled',        variant: 'secondary', description: 'Request was cancelled' },
};

export default function ChangeRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const [request, setRequest] = useState<ChangeRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canAdmin = user?.role === 'super_admin' || user?.role === 'ca_admin';
  const isRequester = request?.requester_id === user?.id;

  function load() {
    if (!id) return;
    setLoading(true);
    changeRequestsApi.get(id)
      .then(setRequest)
      .catch(() => navigate('/change-requests'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [id]);

  async function handleApprove() {
    if (!id) return;
    setSubmitting(true);
    try {
      await changeRequestsApi.approve(id, note);
      toast({ title: 'Request approved', description: 'Policy has been unlocked for 2 hours.', variant: 'success' });
      setShowApproveModal(false);
      load();
    } catch (e: any) {
      toast({ title: 'Failed to approve', description: e.message, variant: 'error' });
    } finally { setSubmitting(false); }
  }

  async function handleReject() {
    if (!id || !note.trim()) return;
    setSubmitting(true);
    try {
      await changeRequestsApi.reject(id, note);
      toast({ title: 'Request rejected', variant: 'success' });
      setShowRejectModal(false);
      load();
    } catch (e: any) {
      toast({ title: 'Failed to reject', description: e.message, variant: 'error' });
    } finally { setSubmitting(false); }
  }

  async function handleComplete() {
    if (!id) return;
    setSubmitting(true);
    try {
      await changeRequestsApi.complete(id);
      toast({ title: 'Request completed', description: 'Policy has been re-locked.', variant: 'success' });
      load();
    } catch (e: any) {
      toast({ title: 'Failed to complete', description: e.message, variant: 'error' });
    } finally { setSubmitting(false); }
  }

  async function handleCancel() {
    if (!id) return;
    setSubmitting(true);
    try {
      await changeRequestsApi.cancel(id);
      toast({ title: 'Request cancelled', variant: 'success' });
      navigate('/change-requests');
    } catch (e: any) {
      toast({ title: 'Failed to cancel', description: e.message, variant: 'error' });
    } finally { setSubmitting(false); }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
    </div>
  );

  if (!request) return null;
  const sc = statusConfig[request.status];

  const timeline = [
    { label: 'Submitted', time: request.created_at, icon: Clock, done: true },
    { label: 'Reviewed', time: request.approved_at, icon: request.status === 'rejected' ? XCircle : CheckCircle2, done: !!request.approved_at },
    { label: 'Policy unlocked', time: request.unlocked_at, icon: Unlock, done: !!request.unlocked_at },
    { label: 'Change detected', time: request.change_detected_at, icon: AlertTriangle, done: !!request.change_detected_at },
    { label: 'Completed', time: request.completed_at, icon: Shield, done: !!request.completed_at },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/change-requests" className="hover:text-indigo-600 flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" />Change Requests
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium truncate">{request.policy_name}</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{request.policy_name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{request.tenant_name}</p>
        </div>
        <Badge variant={sc.variant} className="text-sm px-3 py-1">{sc.label}</Badge>
      </div>

      <p className="text-sm text-gray-500 -mt-2">{sc.description}</p>

      {/* Change detected alert */}
      {request.status === 'change_detected' && canAdmin && (
        <div className="rounded-lg bg-purple-50 border border-purple-200 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-purple-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-purple-800">A change was detected in this policy</p>
            <p className="text-xs text-purple-600 mt-0.5">Review the change and mark as complete to re-lock the policy.</p>
          </div>
          <Button size="sm" onClick={handleComplete} loading={submitting} variant="default">
            <CheckCircle2 className="h-4 w-4" />
            Approve & Re-lock
          </Button>
        </div>
      )}

      {/* Lock expiry warning */}
      {request.status === 'approved' && request.lock_expires_at && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 flex items-center gap-3">
          <Clock className="h-5 w-5 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-700">
            Policy will auto-lock at <strong>{format(new Date(request.lock_expires_at), 'HH:mm')}</strong>{' '}
            ({formatDistanceToNow(new Date(request.lock_expires_at), { addSuffix: true })})
          </p>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Details */}
          <Card>
            <CardHeader><CardTitle>Request Details</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="font-medium text-gray-700 mb-1">Justification</p>
                <p className="text-gray-600 bg-gray-50 rounded-lg p-3">{request.justification}</p>
              </div>
              {request.planned_changes && (
                <div>
                  <p className="font-medium text-gray-700 mb-1">Planned Changes</p>
                  <p className="text-gray-600 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{request.planned_changes}</p>
                </div>
              )}
              {request.approval_note && (
                <div>
                  <p className="font-medium text-gray-700 mb-1">
                    {request.status === 'rejected' ? 'Rejection Note' : 'Approval Note'}
                  </p>
                  <p className="text-gray-600 bg-gray-50 rounded-lg p-3">{request.approval_note}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* People */}
          <Card>
            <CardHeader><CardTitle>People</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100">
                  <User className="h-4 w-4 text-indigo-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{request.requester_display_name}</p>
                  <p className="text-xs text-gray-400">Requester</p>
                </div>
              </div>
              {request.approver_display_name && (
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                    <User className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{request.approver_display_name}</p>
                    <p className="text-xs text-gray-400">Reviewer</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Timeline + actions sidebar */}
        <div className="space-y-4">
          {/* Actions */}
          {request.status === 'pending' && canAdmin && (
            <Card>
              <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <Button className="w-full" onClick={() => { setNote(''); setShowApproveModal(true); }}>
                  <CheckCircle2 className="h-4 w-4" />
                  Approve & Unlock
                </Button>
                <Button variant="destructive" className="w-full" onClick={() => { setNote(''); setShowRejectModal(true); }}>
                  <XCircle className="h-4 w-4" />
                  Reject
                </Button>
              </CardContent>
            </Card>
          )}

          {request.status === 'pending' && isRequester && (
            <Card>
              <CardContent className="pt-5">
                <Button variant="outline" className="w-full" onClick={handleCancel} loading={submitting}>
                  Cancel Request
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Timeline */}
          <Card>
            <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {timeline.map((t, i) => {
                  const Icon = t.icon;
                  return (
                    <div key={i} className="flex gap-3">
                      <div className={`flex h-7 w-7 items-center justify-center rounded-full shrink-0 ${
                        t.done ? 'bg-green-50' : 'bg-gray-100'
                      }`}>
                        <Icon className={`h-3.5 w-3.5 ${t.done ? 'text-green-600' : 'text-gray-400'}`} />
                      </div>
                      <div className="pt-0.5">
                        <p className={`text-sm font-medium ${t.done ? 'text-gray-900' : 'text-gray-400'}`}>{t.label}</p>
                        {t.time && (
                          <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                            <CalendarDays className="h-3 w-3" />
                            {format(new Date(t.time), 'MMM d, HH:mm')}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Policy versions */}
          {(request.pre_version_number || request.post_version_number) && (
            <Card>
              <CardHeader><CardTitle>Backups</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {request.pre_version_number && (
                  <div className="flex items-center gap-2">
                    <RotateCcw className="h-3.5 w-3.5 text-blue-500" />
                    <span className="text-gray-600">Pre-change: v{request.pre_version_number}</span>
                  </div>
                )}
                {request.post_version_number && (
                  <div className="flex items-center gap-2">
                    <RotateCcw className="h-3.5 w-3.5 text-purple-500" />
                    <span className="text-gray-600">Post-change: v{request.post_version_number}</span>
                  </div>
                )}
                <Link
                  to={`/policies/${request.policy_id}`}
                  className="text-xs text-indigo-600 hover:underline block mt-1"
                >
                  View all versions & rollback →
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Approve Modal */}
      <Dialog open={showApproveModal} onOpenChange={setShowApproveModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Change Request</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 mb-3">
            Approving will unlock <strong>{request.policy_name}</strong> for 2 hours. A pre-change backup will be created automatically.
          </p>
          <div>
            <Label>Note (optional)</Label>
            <Textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Add a note for the requester..."
              className="mt-1"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveModal(false)}>Cancel</Button>
            <Button onClick={handleApprove} loading={submitting} variant="success">
              <CheckCircle2 className="h-4 w-4" />
              Approve & Unlock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Change Request</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 mb-3">
            Please provide a reason for rejecting this request.
          </p>
          <div>
            <Label>Rejection reason <span className="text-red-500">*</span></Label>
            <Textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Explain why this request is being rejected..."
              className="mt-1"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectModal(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} loading={submitting} disabled={!note.trim()}>
              <XCircle className="h-4 w-4" />
              Reject Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
