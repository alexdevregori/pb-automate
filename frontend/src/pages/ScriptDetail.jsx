import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Play, MoreHorizontal, Edit3, Pause, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { getScript, runScript, pauseScript, deleteScript } from '../lib/api';
import StatusDot from '../components/StatusDot';
import StatusBadge from '../components/StatusBadge';
import RunRow from '../components/RunRow';
import LogPane from '../components/LogPane';
import { relativeTime } from '../lib/relativeTime';

export default function ScriptDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const load = () =>
    getScript(id)
      .then((d) => {
        setData(d);
        setSelectedId(d.runs?.[0]?.runId || null);
      })
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, [id]);

  // Close kebab menu on outside click.
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  if (error) return <div className="text-sm text-red-600">{error}</div>;
  if (!data) return <div className="text-sm text-gray-500">Loading…</div>;

  const { deployment, runs } = data;
  const selected = runs.find((r) => r.runId === selectedId) || runs[0];
  const status = !selected ? 'manual' : selected.status;

  const handleRun = async () => {
    setRunning(true);
    try {
      await runScript(id);
      toast.success('Run complete');
      await load();
    } catch (e) {
      toast.error(`Run failed: ${e.message}`);
    } finally {
      setRunning(false);
    }
  };

  const handlePauseToggle = async () => {
    setMenuOpen(false);
    setBusy(true);
    try {
      const next = !data.deployment.paused;
      await pauseScript(id, next);
      toast.success(next ? 'Paused' : 'Resumed');
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setMenuOpen(false);
    if (!window.confirm(`Delete this ${data.deployment.scriptId} deployment? This cannot be undone.`)) {
      return;
    }
    setBusy(true);
    try {
      await deleteScript(id);
      toast.success('Deleted');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="mb-2 text-xs text-gray-500">
        <Link to="/dashboard" className="hover:text-pb-dark">Scripts</Link>
        <span className="px-1">›</span>
        <span>{deployment.scriptId}</span>
      </div>

      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="mb-0.5 flex items-center gap-2">
            <StatusDot status={status} />
            <h1 className="text-base font-bold text-pb-dark">{deployment.scriptId}</h1>
            <StatusBadge status={status} />
          </div>
          <div className="text-xs text-gray-500">
            {deployment.schedule}
            {selected && ` · last ran ${relativeTime(selected.startedAt)}`}
          </div>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={handleRun}
            disabled={running}
            className="inline-flex items-center gap-1 rounded-md bg-pb-blue px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-pb-blue/90 disabled:opacity-50"
          >
            <Play size={12} /> {running ? 'Running…' : 'Run'}
          </button>
          <button
            onClick={() => navigate(`/scripts/${id}/edit`)}
            className="inline-flex items-center gap-1 rounded-md border border-pb-blue/30 bg-pb-blue/5 px-2.5 py-1.5 text-xs font-semibold text-pb-blue transition-colors hover:bg-pb-blue/10"
          >
            <Edit3 size={12} /> Edit
          </button>
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              disabled={busy}
              aria-label="More actions"
              className="rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              <MoreHorizontal size={12} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full z-10 mt-1 w-44 overflow-hidden rounded-md border border-gray-200 bg-white text-xs shadow-md">
                <button
                  onClick={handlePauseToggle}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-gray-700 hover:bg-gray-50"
                >
                  {deployment.paused ? <RotateCcw size={12} /> : <Pause size={12} />}
                  {deployment.paused ? 'Resume' : 'Pause'}
                </button>
                <button
                  onClick={handleDelete}
                  className="flex w-full items-center gap-2 border-t border-gray-100 px-3 py-2 text-left text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={12} /> Delete deployment
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-3">
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="border-b border-gray-100 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            Runs ({runs.length})
          </div>
          <div className="overflow-auto" style={{ maxHeight: 'calc(100% - 40px)' }}>
            {runs.length === 0 ? (
              <div className="p-3 text-xs text-gray-500">No runs yet.</div>
            ) : (
              runs.map((r) => (
                <RunRow
                  key={r.runId}
                  run={r}
                  selected={r.runId === selectedId}
                  onClick={() => setSelectedId(r.runId)}
                />
              ))
            )}
          </div>
        </div>

        <div className="flex flex-col rounded-2xl bg-white p-3 shadow-sm">
          {selected ? (
            <>
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusDot status={selected.status} />
                  <span className="text-sm font-semibold text-pb-dark">
                    Run · {relativeTime(selected.startedAt)}
                  </span>
                  <StatusBadge status={selected.status} />
                </div>
                <span className="text-[10px] text-gray-500">
                  {(selected.durationMs / 1000).toFixed(1)}s
                </span>
              </div>
              <div className="min-h-0 flex-1">
                <LogPane logs={selected.logs} />
              </div>
            </>
          ) : (
            <div className="text-sm text-gray-500">
              Nothing to read yet — click Run to trigger one.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
