import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Shield, GitPullRequest, History,
  ClipboardList, Users, Building2, LogOut, Bell, Menu, X, ChevronRight
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { authApi, notificationsApi } from '../../api';
import { cn } from '../../utils/cn';
import DemoBanner from './DemoBanner';

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';
import { Badge } from '../ui';
import type { UserRole } from '../../types';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['super_admin','ca_admin','azure_admin','viewer'] },
  { to: '/policies', icon: Shield, label: 'CA Policies', roles: ['super_admin','ca_admin','azure_admin','viewer'] },
  { to: '/change-requests', icon: GitPullRequest, label: 'Change Requests', roles: ['super_admin','ca_admin','azure_admin'] },
  { to: '/history', icon: History, label: 'Version History', roles: ['super_admin','ca_admin','azure_admin','viewer'] },
  { to: '/audit', icon: ClipboardList, label: 'Audit Log', roles: ['super_admin','ca_admin'] },
  { to: '/users', icon: Users, label: 'Users', roles: ['super_admin'] },
  { to: '/tenants', icon: Building2, label: 'Tenants', roles: ['super_admin','ca_admin'] },
];

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    notificationsApi.list().then(d => setUnreadCount(d.unreadCount)).catch(() => {});
    const interval = setInterval(() => {
      notificationsApi.list().then(d => setUnreadCount(d.unreadCount)).catch(() => {});
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  async function handleLogout() {
    await authApi.logout().catch(() => {});
    logout();
    navigate('/login');
  }

  const visibleNav = navItems.filter(item =>
    user ? item.roles.includes(user.role as UserRole) : false
  );

  const roleLabel: Record<UserRole, string> = {
    super_admin: 'Super Admin',
    ca_admin: 'CA Admin',
    azure_admin: 'Azure Admin',
    viewer: 'Viewer',
  };

  const roleBadge: Record<UserRole, 'default' | 'info' | 'warning' | 'secondary'> = {
    super_admin: 'default',
    ca_admin: 'info',
    azure_admin: 'warning',
    viewer: 'secondary',
  };

  const Sidebar = () => (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-indigo-800">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
          <Shield className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-white">Stone Guard</p>
          <p className="text-xs text-indigo-300">{DEMO_MODE ? 'Demo Mode' : 'Policy Management'}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visibleNav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }: { isActive: boolean }) =>
              cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                isActive
                  ? 'bg-white/15 text-white'
                  : 'text-indigo-200 hover:bg-white/10 hover:text-white'
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
            <ChevronRight className="ml-auto h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-indigo-800 p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500 text-white text-sm font-semibold shrink-0">
            {user?.display_name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-white truncate">{user?.display_name}</p>
            <p className="text-xs text-indigo-300 truncate">{user?.email}</p>
          </div>
        </div>
        {user?.role && (
          <Badge variant={roleBadge[user.role as UserRole]} className="mb-3 text-xs">
            {roleLabel[user.role as UserRole]}
          </Badge>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full rounded-md px-3 py-1.5 text-xs text-indigo-200 hover:bg-white/10 hover:text-white transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <DemoBanner />
      <div className="flex flex-1 min-h-0">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-60 lg:flex-col bg-indigo-900">
        <Sidebar />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-60 bg-indigo-900 z-50">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute right-3 top-3 text-indigo-200 hover:text-white p-1"
            >
              <X className="h-5 w-5" />
            </button>
            <Sidebar />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col lg:pl-60 min-h-full">
        {/* Top bar */}
        <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-white px-4 lg:px-6 shadow-sm">
          <button
            className="lg:hidden text-gray-500 hover:text-gray-700"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex-1" />

          {/* Notification bell */}
          <NavLink to="/change-requests?status=pending" className="relative p-2 text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-100 transition-colors">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </NavLink>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 animate-fade-in">
          <Outlet />
        </main>
      </div>
      </div>
    </div>
  );
}
