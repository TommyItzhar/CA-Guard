import { useState } from 'react';
import { Shield, Lock, FlaskConical } from 'lucide-react';
import { authApi } from '../api';
import { Button } from '../components/ui';

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

const demoRoles = [
  { role: 'ca_admin',    label: 'CA Admin',    desc: 'Approve requests, manage policies' },
  { role: 'azure_admin', label: 'Azure Admin',  desc: 'Submit change requests' },
  { role: 'super_admin', label: 'Super Admin',  desc: 'Full access' },
  { role: 'viewer',      label: 'Viewer',       desc: 'Read-only access' },
];

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const params = new URLSearchParams(window.location.search);
  const urlError = params.get('error');

  async function handleLogin() {
    setLoading(true); setError('');
    try {
      const { authUrl } = await authApi.getLoginUrl();
      window.location.href = authUrl;
    } catch { setError('Failed to initiate login. Please try again.'); setLoading(false); }
  }

  function handleDemoLogin(role: string) {
    setDemoLoading(role);
    window.location.href = `/api/auth/instant-login?role=${role}`;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-indigo-800 to-indigo-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-white/10 backdrop-blur mb-4">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Stone Guard</h1>
          <p className="mt-2 text-indigo-200 text-sm">Conditional Access Policy Management Platform</p>
        </div>

        {DEMO_MODE && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-4 shadow-xl">
            <div className="flex items-center gap-2 mb-2">
              <FlaskConical className="h-5 w-5 text-amber-600" />
              <p className="font-semibold text-amber-900">Try without an Azure account</p>
            </div>
            <p className="text-sm text-amber-700 mb-4">
              Sign in as a demo user to explore the full UI with 10 simulated CA policies, change requests, version history, and rollback — no subscription needed.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {demoRoles.map(({ role, label, desc }) => (
                <button key={role} onClick={() => handleDemoLogin(role)} disabled={!!demoLoading}
                  className="text-left p-3 rounded-xl border-2 border-amber-200 bg-white hover:border-amber-400 hover:bg-amber-50 transition-all disabled:opacity-50">
                  <p className="font-semibold text-amber-900 text-sm">{demoLoading === role ? 'Signing in...' : label}</p>
                  <p className="text-xs text-amber-600 mt-0.5">{desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Sign in with Azure</h2>
            <p className="mt-1 text-sm text-gray-500">Use your Azure AD credentials with MFA to access the platform.</p>
          </div>
          {(error || urlError) && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-700">{error || decodeURIComponent(urlError!)}</p>
            </div>
          )}
          <Button onClick={handleLogin} loading={loading} className="w-full h-11 text-base">
            <svg className="h-5 w-5" viewBox="0 0 21 21" fill="none">
              <rect x="1" y="1" width="9" height="9" fill="#F25022"/><rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
              <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/><rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
            </svg>
            {loading ? 'Redirecting to Azure...' : 'Sign in with Microsoft'}
          </Button>
          <div className="mt-6 border-t pt-5">
            <div className="flex items-start gap-3 text-sm text-gray-500">
              <Lock className="h-4 w-4 mt-0.5 shrink-0 text-indigo-500" />
              <p>Multi-factor authentication is required. Your session expires after 8 hours.</p>
            </div>
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-indigo-300">© {new Date().getFullYear()} Stone Guard</p>
      </div>
    </div>
  );
}
