import { Navigate, Outlet, useLocation } from 'react-router-dom';
import Sidenav from './Sidenav';
import { isAuthenticated } from '../lib/auth';

export default function AppLayout() {
  const { search } = useLocation();
  const hasInboundToken = new URLSearchParams(search).has('token');
  if (!isAuthenticated() && !hasInboundToken) return <Navigate to="/" replace />;
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidenav workspaceLabel="My Workspace" />
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
