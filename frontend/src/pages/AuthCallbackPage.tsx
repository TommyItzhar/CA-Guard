import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../api';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const redirect = params.get('redirect') || '/dashboard';

    if (!token) {
      navigate('/login?error=No+token+received');
      return;
    }

    // Store token then fetch user
    useAuthStore.setState({ token, isAuthenticated: true });

    authApi.getMe()
      .then((user) => {
        setAuth(user, token);
        navigate(redirect, { replace: true });
      })
      .catch(() => {
        navigate('/login?error=Failed+to+fetch+user+profile');
      });
  }, [navigate, setAuth]);

  return (
    <div className="min-h-screen bg-indigo-900 flex items-center justify-center">
      <div className="text-center">
        <Shield className="h-12 w-12 text-white mx-auto mb-4 animate-pulse" />
        <p className="text-white text-lg font-medium">Completing sign-in...</p>
        <p className="text-indigo-300 text-sm mt-2">Verifying your credentials</p>
      </div>
    </div>
  );
}
