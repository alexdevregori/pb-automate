import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, MoreHorizontal, Pause, Trash2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { runScript, pauseScript, deleteScript } from '../lib/api';
import StatusDot from './StatusDot';
import StatusBadge from './StatusBadge';
import Sparkline from './Sparkline';
import { relativeTime } from '../lib/relativeTime';

export default function ScriptRow({ deployment, onChanged }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const latestRun = deployment.latestRun;
  const recentRuns = deployment.recentRuns || [];

  const status = deployment.paused
    ? 'paused'
    : !latestRun
      ? 'manual'
      : latestRun.status;

  const scheduleLabel =
    deployment.schedule === 'manual' ? 'Manual trigger' :
    deployment.schedule === 'on-change' ? 'On webhook event' :
    `${deployment.schedule}`;

  const lastRunLine = !latestRun
    ? 'Never run'
    : latestRun.status === 'fail'
      ? `${relativeTime(latestRun.startedAt)} · ${latestRun.error || latestRun.summary}`
      : `${relativeTime(latestRun.startedAt)} · ${latestRun.summary}`;

  const stop = (e) => e.stopPropagation();

  const handleRun = async (e) => {
    stop(e);
    setBusy(true);
    try {
      const result = await runScript(deployment.id);
      if (result?.run?.status === 'fail') {
        toast.error(`Run failed: ${result.run.summary}`);
      } else {
        toast.success(`${deployment.scriptId} ran successfully`);
      }
      onChanged?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handlePauseToggle = async (e) => {
    stop(e);
    setMenuOpen(false);
    setBusy(true);
    try {
      const next = !deployment.paused;
      await pauseScript(deployment.id, next);
      toast.success(next ? 'Paused' : 'Resumed');
      onChanged?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (e) => {
    stop(e);
    setMenuOpen(false);
    if (!window.confirm(`Delete this ${deployment.scriptId} deployment? This cannot be undone.`)) {
      return;
    }
    setBusy(true);
    try {
      await deleteScript(deployment.id);
      toast.success('Deleted');
      onChanged?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      onClick={() => navigate(`/scripts/${deployment.id}`)}
      className="cursor-pointer border-b border-gray-100 p-4 last:border-b-0 hover:bg-gray-50"
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusDot status={status} />
          <span className="text-sm font-semibold text-pb-dark">{deployment.scriptId}</span>
          <StatusBadge status={status} />
        </div>
        <div className="relative flex gap-1.5" onClick={stop} ref={menuRef}>
          <button
            onClick={handleRun}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            <Play size={12} /> Run
          </button>

          <button
            onClick={(e) => { stop(e); setMenuOpen((o) => !o); }}
            disabled={busy}
            className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            aria-label="More actions"
          >
            <MoreHorizontal size={12} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full z-10 mt-1 w-40 overflow-hidden rounded-md border border-gray-200 bg-white text-xs shadow-md">
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
                <Trash2 size={12} /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Field label="Schedule" value={scheduleLabel} />
        <Field
          label="Last run"
          value={lastRunLine}
          valueClass={latestRun?.status === 'fail' ? 'text-red-700' : ''}
        />
        <div>
          <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            Last 7 runs
          </div>
          <Sparkline runs={recentRuns} />
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, valueClass = '' }) {
  return (
    <div>
      <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</div>
      <div className={`text-xs font-medium text-pb-dark ${valueClass}`}>{value}</div>
    </div>
  );
}
