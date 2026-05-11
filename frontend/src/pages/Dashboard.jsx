import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Zap, Check } from 'lucide-react';
import { getScripts } from '../lib/api';
import ScriptRow from '../components/ScriptRow';
import { identify, capture } from '../lib/analytics';
import { getWorkspaceId } from '../lib/auth';

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState({ scripts: [], deployments: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = () => getScripts().then(setData).catch((e) => setError(e.message));

  useEffect(() => {
    // Capture token from OAuth redirect (?token=...) and persist before any API call.
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

  if (loading) return <div className="text-sm text-gray-500">Loading…</div>;
  if (error) return <div className="text-sm text-red-600">Error: {error}</div>;

  const deployments = data.deployments || [];

  if (deployments.length === 0) {
    return (
      <div className="mx-auto max-w-md rounded-2xl bg-white p-10 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-pb-blue">
          <Zap size={26} />
        </div>
        <h1 className="mb-1 text-lg font-bold text-pb-dark">Welcome to PB Automate</h1>
        <p className="mb-5 text-sm text-gray-500">
          Deploy automation scripts to your Productboard workspace — no code required.
        </p>
        <button
          onClick={() => {
            capture('add_script_clicked', { from: 'welcome_hero' });
            navigate('/scripts/new');
          }}
          className="rounded-lg bg-pb-blue px-4 py-2 text-sm font-semibold text-white hover:bg-pb-blue/90"
        >
          + Deploy your first script
        </button>
        <div className="mt-4 flex items-center justify-center gap-3 text-[11px] text-gray-500">
          <span className="flex items-center gap-0.5"><Check size={10} /> Sync custom fields</span>
          <span className="text-gray-300">·</span>
          <span className="flex items-center gap-0.5"><Check size={10} /> Roll up scores</span>
          <span className="text-gray-300">·</span>
          <span className="flex items-center gap-0.5"><Check size={10} /> Propagate tags</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-pb-dark">Your Scripts</h1>
          <p className="text-xs text-gray-500">{deployments.length} active</p>
        </div>
        <button
          onClick={() => {
            capture('add_script_clicked', { from: 'dashboard_header' });
            navigate('/scripts/new');
          }}
          className="inline-flex items-center gap-1 rounded-lg bg-pb-blue px-3 py-1.5 text-xs font-semibold text-white hover:bg-pb-blue/90"
        >
          <Plus size={14} /> Add Script
        </button>
      </div>

      <div className="rounded-2xl bg-white shadow-sm">
        {deployments.map((d) => (
          <ScriptRow key={d.id} deployment={d} onChanged={reload} />
        ))}
      </div>
    </>
  );
}
