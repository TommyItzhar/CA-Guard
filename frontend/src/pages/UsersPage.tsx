import { useEffect, useState } from 'react';
import { usersApi } from '../api';
import { Card, Badge, Button, Select } from '../components/ui';
import { toast } from '../components/ui/toaster';
import { format } from 'date-fns';
import type { User, UserRole } from '../types';

const roleLabels: Record<UserRole, string> = {
  super_admin: 'Super Admin', ca_admin: 'CA Admin',
  azure_admin: 'Azure Admin', viewer: 'Viewer',
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  function load() { usersApi.list().then(setUsers).finally(() => setLoading(false)); }
  useEffect(() => { load(); }, []);

  async function handleRoleChange(userId: string, role: string) {
    try {
      await usersApi.setRole(userId, role);
      toast({ title: 'Role updated', variant: 'success' });
      load();
    } catch (e: any) { toast({ title: 'Failed to update role', description: e.message, variant: 'error' }); }
  }

  async function handleToggleStatus(user: User) {
    try {
      await usersApi.setStatus(user.id, !user.is_active);
      toast({ title: `User ${user.is_active ? 'deactivated' : 'activated'}`, variant: 'success' });
      load();
    } catch (e: any) { toast({ title: 'Failed', description: e.message, variant: 'error' }); }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <p className="text-sm text-gray-500 mt-1">{users.length} registered users</p>
      </div>
      <Card>
        {loading ? (
          <div className="text-center py-10 text-gray-400">Loading users...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  {['User', 'Role', 'Status', 'Last login', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-semibold text-xs shrink-0">
                          {u.display_name?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{u.display_name}</p>
                          <p className="text-xs text-gray-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Select
                        value={u.role}
                        onChange={e => handleRoleChange(u.id, e.target.value)}
                        className="w-36 h-7 text-xs"
                      >
                        {(Object.keys(roleLabels) as UserRole[]).map(r => (
                          <option key={r} value={r}>{roleLabels[r]}</option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={u.is_active ? 'success' : 'secondary'}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {u.last_login ? format(new Date(u.last_login), 'MMM d, yyyy') : 'Never'}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant={u.is_active ? 'outline' : 'secondary'}
                        size="sm"
                        onClick={() => handleToggleStatus(u)}
                      >
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
