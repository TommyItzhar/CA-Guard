import { useEffect, useState } from 'react';
import { Building2, RefreshCw, Plus, CheckCircle2, AlertTriangle } from 'lucide-react';
import { tenantsApi } from '../api';
import { Card, CardContent, Badge, Button, Input, Label, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui';
import { toast } from '../components/ui/toaster';
import { format, formatDistanceToNow } from 'date-fns';
import type { Tenant } from '../types';

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({ tenantId: '', displayName: '', clientId: '', clientSecret: '' });
  const [submitting, setSubmitting] = useState(false);

  function load() { tenantsApi.list().then(setTenants).finally(() => setLoading(false)); }
  useEffect(() => { load(); }, []);

  async function handleSync(id: string) {
    setSyncing(id);
    try {
      const res = await tenantsApi.sync(id);
      toast({ title: `Sync complete: ${res.created} created, ${res.updated} updated`, variant: 'success' });
      load();
    } catch (e: any) {
      toast({ title: 'Sync failed', description: e.message, variant: 'error' });
    } finally { setSyncing(null); }
  }

  async function handleAdd() {
    setSubmitting(true);
    try {
      await tenantsApi.create(form);
      toast({ title: 'Tenant added successfully', variant: 'success' });
      setShowAddModal(false);
      setForm({ tenantId: '', displayName: '', clientId: '', clientSecret: '' });
      load();
    } catch (e: any) {
      toast({ title: 'Failed to add tenant', description: e.message, variant: 'error' });
    } finally { setSubmitting(false); }
  }

  const syncStatusConfig: Record<string, { label: string; variant: 'success' | 'danger' | 'secondary' | 'warning' }> = {
    success: { label: 'Synced',   variant: 'success' },
    error:   { label: 'Error',    variant: 'danger' },
    syncing: { label: 'Syncing',  variant: 'warning' },
    pending: { label: 'Pending',  variant: 'secondary' },
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tenants</h1>
          <p className="text-sm text-gray-500 mt-1">Manage connected Azure tenants</p>
        </div>
        <Button onClick={() => setShowAddModal(true)} size="sm">
          <Plus className="h-4 w-4" /> Add Tenant
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Loading tenants...</div>
      ) : tenants.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border">
          <Building2 className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No tenants connected</p>
          <p className="text-sm text-gray-400 mt-1">Add an Azure tenant to get started</p>
          <Button onClick={() => setShowAddModal(true)} className="mt-4" size="sm">
            <Plus className="h-4 w-4" /> Add First Tenant
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {tenants.map(t => {
            const sc = syncStatusConfig[t.sync_status] || { label: t.sync_status, variant: 'secondary' as const };
            return (
              <Card key={t.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50">
                        <Building2 className="h-5 w-5 text-indigo-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{t.display_name}</p>
                        <p className="text-xs text-gray-400 font-mono mt-0.5">{t.tenant_id}</p>
                      </div>
                    </div>
                    <Badge variant={sc.variant}>{sc.label}</Badge>
                  </div>

                  <div className="space-y-1.5 text-xs text-gray-500 border-t pt-3 mb-4">
                    <div className="flex items-center gap-1.5">
                      {t.is_active ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                      <span>{t.is_active ? 'Active' : 'Inactive'}</span>
                    </div>
                    <p>Last sync: {t.last_sync ? format(new Date(t.last_sync), 'MMM d, yyyy HH:mm') : 'Never'}</p>
                    <p>Added: {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}</p>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    loading={syncing === t.id}
                    onClick={() => handleSync(t.id)}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Sync Policies
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Tenant Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Azure Tenant</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-700">
              <p className="font-medium mb-1">Required App Registration permissions:</p>
              <ul className="list-disc list-inside space-y-0.5 text-blue-600">
                <li>Policy.Read.All</li>
                <li>Policy.ReadWrite.ConditionalAccess</li>
                <li>AuditLog.Read.All</li>
                <li>Organization.Read.All</li>
              </ul>
            </div>
            {[
              { key: 'tenantId', label: 'Tenant ID (Directory ID)', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
              { key: 'displayName', label: 'Display Name', placeholder: 'My Organization' },
              { key: 'clientId', label: 'Application (Client) ID', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
              { key: 'clientSecret', label: 'Client Secret', placeholder: 'Your app registration secret' },
            ].map(f => (
              <div key={f.key}>
                <Label>{f.label}</Label>
                <Input
                  type={f.key === 'clientSecret' ? 'password' : 'text'}
                  value={form[f.key as keyof typeof form]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="mt-1 font-mono text-sm"
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button
              onClick={handleAdd}
              loading={submitting}
              disabled={!form.tenantId || !form.clientId || !form.clientSecret}
            >
              <Plus className="h-4 w-4" />
              {submitting ? 'Verifying credentials...' : 'Add Tenant'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
