import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, MoreHorizontal, Pause, Trash2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { runScript, pauseScript, deleteScript } from '../lib/api';
import StatusBadge from './StatusBadge';
import Sparkline from './Sparkline';
import { relativeTime } from '../lib/relativeTime';

const TYPE_LABELS = {
  product: 'product', component: 'component', feature: 'feature',
  subfeature: 'sub-feature', release: 'release', initiative: 'initiative',
  objective: 'objective', keyResult: 'key result',
};

function TreeNode({ label, isParent = false }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[11.5px] font-medium ${
      isParent ? 'bg-pb-err-bg text-pb-err-text' : 'bg-pb-warm text-pb-muted'
    }`}>
      {label}
    </span>
  );
}

export default function ScriptRow({ deployment, onChanged }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

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
  const cfg = deployment.config || {};

  const stop = (e) => e.stopPropagation();

  const handleRun = async (e) => {
    stop(e);
    setBusy(true);
    try {
      const result = await runScript(deployment.id);
      if (result?.run?.status === 'fail') toast.error(`Run failed: ${result.run.summary}`);
      else toast.success('Run complete');
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
    if (!window.confirm(`Delete "${deployment.name || deployment.scriptId}"? This cannot be undone.`)) return;
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

  const lastRunLine = !latestRun
    ? 'Never run'
    : `Last run ${relativeTime(latestRun.startedAt)} · ${latestRun.summary}`;

  const scheduleLabel =
    deployment.schedule === 'manual' ? 'Manual trigger' :
    deployment.schedule === 'daily'  ? 'Daily sync' :
    deployment.schedule || 'Manual trigger';

  return (
    <div
      onClick={() => navigate(`/scripts/${deployment.id}`)}
      className="cursor-pointer border-b border-pb-dark/[0.06] p-5 last:border-b-0 hover:bg-pb-cream/50"
    >
      {/* Name + badge row */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className={`h-2 w-2 rounded-full ${
            deployment.paused ? 'bg-pb-subtle' :
            !latestRun        ? 'bg-pb-subtle' :
            latestRun.status === 'fail'    ? 'bg-pb-err' :
            latestRun.status === 'partial' ? 'bg-pb-amber' :
                                             'bg-pb-green'
          }`} />
          <span className="font-sans font-semibold text-[17px] tracking-tight text-pb-dark">
            {deployment.name || deployment.scriptId}
          </span>
          <StatusBadge
            status={deployment.paused ? 'paused' : latestRun?.status || 'manual'}
            errorCount={latestRun?.errorCount}
          />
        </div>
        <div className="relative flex items-center gap-1.5" onClick={stop} ref={menuRef}>
          <button
            onClick={handleRun}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-pb-dark px-3 py-1.5 text-xs font-medium text-pb-cream transition-colors hover:bg-pb-dark/90 disabled:opacity-50"
          >
            <Play size={12} /> Run
          </button>
          <button
            onClick={(e) => { stop(e); setMenuOpen((o) => !o); }}
            disabled={busy}
            className="rounded-lg border border-pb-dark/[0.14] px-2 py-1.5 text-pb-muted hover:bg-pb-cream disabled:opacity-50"
            aria-label="More actions"
          >
            <MoreHorizontal size={14} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-10 mt-1 w-36 overflow-hidden rounded-xl border border-pb-dark/[0.08] bg-white text-[12.5px] font-medium shadow-md">
              <button
                onClick={handlePauseToggle}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-pb-muted hover:bg-pb-cream"
              >
                {deployment.paused ? <RotateCcw size={13} /> : <Pause size={13} />}
                {deployment.paused ? 'Resume' : 'Pause'}
              </button>
              <button
                onClick={handleDelete}
                className="flex w-full items-center gap-2 border-t border-pb-dark/[0.06] px-3 py-2.5 text-left text-pb-err-text hover:bg-pb-err-bg"
              >
                <Trash2 size={13} /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tree nodes row */}
      {cfg.parentType && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <TreeNode label={TYPE_LABELS[cfg.parentType] || cfg.parentType} isParent />
          {(cfg.childTypes || []).length > 0 && (
            <>
              <span className="text-[11px] text-pb-subtle">→</span>
              {cfg.childTypes.map((t) => (
                <TreeNode key={t} label={TYPE_LABELS[t] || t} />
              ))}
            </>
          )}
          {cfg.fieldName && (
            <span className="ml-1.5 text-[11.5px] text-pb-subtle">
              · field{' '}
              <code className="rounded bg-pb-warm px-1.5 py-0.5 text-[11px] text-pb-dark">
                {cfg.fieldName}
              </code>
            </span>
          )}
        </div>
      )}

      {/* Stats row */}
      <div className="flex items-center gap-5 text-[12.5px] text-pb-muted">
        <span>{scheduleLabel}</span>
        <span className={latestRun?.status === 'fail' ? 'text-pb-err-text' : ''}>{lastRunLine}</span>
        <div className="ml-auto flex flex-col items-end gap-1">
          <div className="text-[10px] font-medium uppercase tracking-widest text-pb-subtle">Last 7 runs</div>
          <Sparkline runs={recentRuns} />
        </div>
      </div>
    </div>
  );
}
