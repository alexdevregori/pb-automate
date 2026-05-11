import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { getScripts } from '../lib/api';
import ScriptRow from '../components/ScriptRow';
import { identify, capture } from '../lib/events';
import { getWorkspaceId } from '../lib/auth';

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState({ scripts: [], deployments: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = () => getScripts().then(setData).catch((e) => setError(e.message));

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('token');
    if (tokenFromUrl) {
      localStorage.setItem('pb_token', tokenFromUrl);
      window.history.replaceState({}, '', '/dashboard');
    }
    const wsId = getWorkspaceId();
    if (wsId) identify(wsId);
    reload().finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-sm text-pb-subtle">Loading…</div>;
  if (error) return <div className="text-sm text-pb-err-text">Error: {error}</div>;

  const deployments = data.deployments || [];

  if (deployments.length === 0) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-pb-dark/[0.08] bg-white p-10 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-pb-err-bg">
          <svg width="22" height="22" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <path d="M 10 18 L 50 18 L 90 50 L 50 82 L 10 82 L 38 50 Z" fill="#993C1D" />
          </svg>
        </div>
        <h1 className="mb-1.5 font-sans font-semibold text-xl tracking-tight text-pb-dark">Welcome to Automate</h1>
        <p className="mb-6 text-[13.5px] text-pb-muted">
          Deploy field-sync scripts to your Productboard workspace — no code required.
        </p>
        <button
          onClick={() => {
            capture('add_script_clicked', { from: 'welcome_hero' });
            navigate('/scripts/new');
          }}
          className="rounded-lg bg-pb-dark px-5 py-2.5 text-sm font-medium text-pb-cream transition-colors hover:bg-pb-dark/90"
        >
          Deploy your first script
        </button>
      </div>
    );
  }

  const activeCount = deployments.filter((d) => !d.paused).length;

  return (
    <>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-sans font-semibold text-3xl tracking-tight text-pb-dark">Your scripts</h1>
          <p className="mt-1.5 text-[13.5px] text-pb-muted">
            Automations that keep your product hierarchy in sync.{' '}
            <span className="font-medium text-pb-dark">{activeCount} active</span>
          </p>
        </div>
        <button
          onClick={() => {
            capture('add_script_clicked', { from: 'dashboard_header' });
            navigate('/scripts/new');
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-pb-dark px-4 py-2 text-sm font-medium text-pb-cream transition-colors hover:bg-pb-dark/90"
        >
          <Plus size={15} /> New script
        </button>
      </div>

      <div className="rounded-2xl border border-pb-dark/[0.08] bg-white shadow-sm">
        {deployments.map((d) => (
          <ScriptRow key={d.id} deployment={d} onChanged={reload} />
        ))}
      </div>
    </>
  );
}
