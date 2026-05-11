import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Activity, Settings, LogOut, ScrollText } from 'lucide-react';
import { clearToken } from '../lib/auth';
import { capture, reset } from '../lib/events';

const items = [
  { to: '/dashboard', label: 'Scripts', icon: ScrollText,
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
    <aside className="flex w-56 flex-col border-r border-pb-dark/[0.06] bg-pb-cream-md">
      {/* Logo + workspace */}
      <div className="flex items-center gap-2.5 px-4 pb-5 pt-5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-pb-dark">
          <svg width="16" height="16" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M 10 18 L 50 18 L 90 50 L 50 82 L 10 82 L 38 50 Z" fill="#FAF7F2" />
          </svg>
        </div>
        <div>
          <div className="font-sans font-semibold text-base leading-tight tracking-tight text-pb-dark">Automate</div>
          <div className="mt-0.5 truncate text-[11px] text-pb-subtle" title={workspaceLabel}>{workspaceLabel}</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3">
        <div className="mb-2 px-2 text-[10px] font-medium uppercase tracking-widest text-pb-subtle">Workspace</div>
        {items.map(({ to, label, icon: Icon, matches }) => {
          const active = matches(pathname);
          return (
            <NavLink
              key={to}
              to={to}
              className={`mb-0.5 flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors ${
                active
                  ? 'bg-pb-dark text-pb-cream'
                  : 'text-pb-muted hover:bg-pb-dark/[0.04] hover:text-pb-dark'
              }`}
            >
              <Icon size={15} />
              {label}
            </NavLink>
          );
        })}
      </nav>

      {/* Connection indicator */}
      <div className="mx-3 mb-3 rounded-lg border border-pb-dark/[0.08] bg-white p-3">
        <div className="text-[11px] font-medium text-pb-subtle">API connection</div>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-pb-green" />
          <span className="text-[12.5px] font-medium text-pb-dark">Productboard</span>
        </div>
        <div className="mt-0.5 text-[11px] text-pb-subtle">Connected</div>
      </div>

      <button
        onClick={handleLogout}
        className="mx-3 mb-3 flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-pb-subtle hover:bg-pb-dark/[0.04] hover:text-pb-dark"
      >
        <LogOut size={14} />
        Sign out
      </button>
    </aside>
  );
}
