import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Boxes, Activity, Settings, LogOut } from 'lucide-react';
import { clearToken } from '../lib/auth';
import { capture, reset } from '../lib/analytics';

const items = [
  { to: '/dashboard', label: 'Scripts', icon: Boxes,
    matches: (p) => p.startsWith('/dashboard') || p.startsWith('/scripts') },
  { to: '/activity', label: 'Activity', icon: Activity,
    matches: (p) => p.startsWith('/activity') },
  { to: '/settings', label: 'Settings', icon: Settings,
    matches: (p) => p.startsWith('/settings') },
];

export default function Sidenav({ workspaceLabel = 'My Workspace' }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const handleLogout = () => {
    capture('signed_out');
    clearToken();
    reset();
    navigate('/');
  };

  return (
    <aside className="flex w-44 flex-col border-r border-gray-200 bg-white">
      <div className="px-3 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-pb-blue" />
          <span className="text-sm font-bold text-pb-dark">PB Automate</span>
        </div>
        <div className="mt-1 truncate text-xs text-gray-500" title={workspaceLabel}>
          {workspaceLabel}
        </div>
      </div>

      <nav className="flex-1 px-2">
        {items.map(({ to, label, icon: Icon, matches }) => {
          const active = matches(pathname);
          return (
            <NavLink
              key={to}
              to={to}
              className={`mb-0.5 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${
                active ? 'bg-indigo-50 text-pb-blue' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Icon size={14} />
              {label}
            </NavLink>
          );
        })}
      </nav>

      <button
        onClick={handleLogout}
        className="m-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-gray-500 hover:bg-gray-50 hover:text-pb-dark"
      >
        <LogOut size={14} />
        Sign out
      </button>
    </aside>
  );
}
