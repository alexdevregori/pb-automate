import { useEffect } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidenav from './Sidenav';
import { isAuthenticated, clearToken } from '../lib/auth';
import { reset } from '../lib/events';
import { checkPBStatus } from '../lib/api';

export default function AppLayout() {
  const { search, pathname } = useLocation();
  const navigate = useNavigate();
  const hasInboundToken = new URLSearchParams(search).has('token');

  useEffect(() => {
    checkPBStatus().catch((err) => {
      // 401 from our backend means PB rejected the stored token — OAuth app was removed.
      // Any other status (network error, PB outage) — leave the user logged in.
      if (err.status === 401) {
        clearToken();
        reset();
        navigate('/?disconnected=1', { replace: true });
      }
    });
  }, [pathname]); // re-run on every page navigation

  if (!isAuthenticated() && !hasInboundToken) return <Navigate to="/" replace />;
  return (
    <div className="flex min-h-screen bg-pb-cream">
      <Sidenav workspaceLabel="My Workspace" />
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
