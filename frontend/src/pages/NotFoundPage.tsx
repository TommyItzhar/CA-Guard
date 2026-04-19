import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { Button } from '../components/ui';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <Shield className="h-16 w-16 text-indigo-200 mx-auto mb-4" />
        <h1 className="text-4xl font-bold text-gray-900 mb-2">404</h1>
        <p className="text-gray-500 mb-6">This page doesn't exist.</p>
        <Link to="/dashboard"><Button>Back to Dashboard</Button></Link>
      </div>
    </div>
  );
}
