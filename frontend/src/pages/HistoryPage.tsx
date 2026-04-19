// HistoryPage.tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { History, RotateCcw } from 'lucide-react';
import { versionsApi, policiesApi } from '../api';
import { Card, Select } from '../components/ui';
import { format } from 'date-fns';
import type { CAPolicy, PolicyVersion } from '../types';
import { cn } from '../utils/cn';

const changeTypeConfig: Record<string, { label: string; color: string }> = {
  initial:     { label: 'Initial',          color: 'bg-gray-100 text-gray-600' },
  pre_change:  { label: 'Pre-change backup', color: 'bg-blue-100 text-blue-700' },
  post_change: { label: 'Post-change',       color: 'bg-purple-100 text-purple-700' },
  rollback:    { label: 'Rollback',          color: 'bg-amber-100 text-amber-700' },
  sync:        { label: 'Sync',              color: 'bg-gray-100 text-gray-500' },
};

export function HistoryPage() {
  const [policies, setPolicies] = useState<CAPolicy[]>([]);
  const [versions, setVersions] = useState<PolicyVersion[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { policiesApi.list().then(setPolicies).catch(() => {}); }, []);

  useEffect(() => {
    if (!selectedPolicy) return;
    setLoading(true);
    versionsApi.list(selectedPolicy).then(setVersions).finally(() => setLoading(false));
  }, [selectedPolicy]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Version History</h1>
        <p className="text-sm text-gray-500 mt-1">Browse and restore previous policy versions</p>
      </div>
      <Select
        value={selectedPolicy}
        onChange={e => setSelectedPolicy(e.target.value)}
        className="w-full max-w-md"
      >
        <option value="">Select a policy...</option>
        {policies.map(p => <option key={p.id} value={p.id}>{p.display_name} ({p.tenant_name})</option>)}
      </Select>

      {selectedPolicy && (
        loading ? (
          <div className="text-center py-8 text-gray-400">Loading versions...</div>
        ) : (
          <Card>
            <div className="divide-y">
              {versions.length === 0 ? (
                <p className="text-center py-8 text-gray-400 text-sm">No versions found</p>
              ) : versions.map(v => {
                const ctc = changeTypeConfig[v.change_type] || { label: v.change_type, color: 'bg-gray-100 text-gray-600' };
                return (
                  <div key={v.id} className="flex items-center gap-4 p-4 hover:bg-gray-50">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 shrink-0">
                      <History className="h-4 w-4 text-indigo-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900 text-sm">v{v.version_number}</span>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', ctc.color)}>{ctc.label}</span>
                      </div>
                      {v.change_summary && <p className="text-xs text-gray-500 mt-0.5 truncate">{v.change_summary}</p>}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {v.created_by_name || 'System'} · {format(new Date(v.created_at), 'MMM d, yyyy HH:mm')}
                      </p>
                    </div>
                    <Link
                      to={`/policies/${selectedPolicy}`}
                      className="flex items-center gap-1 text-xs text-indigo-600 hover:underline shrink-0"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Restore
                    </Link>
                  </div>
                );
              })}
            </div>
          </Card>
        )
      )}

      {!selectedPolicy && (
        <div className="text-center py-16 bg-white rounded-lg border">
          <History className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Select a policy to view its version history</p>
        </div>
      )}
    </div>
  );
}
export default HistoryPage;
