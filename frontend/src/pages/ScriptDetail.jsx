import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Play, MoreHorizontal, Edit3, Pause, RotateCcw, Trash2, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { getScript, runScript, pauseScript, deleteScript } from '../lib/api';
import StatusBadge from '../components/StatusBadge';
import RunRow from '../components/RunRow';
import LogPane from '../components/LogPane';
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

export default function ScriptDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef(null);

  const load = () =>
    getScript(id)
      .then((d) => {
        setData(d);
        setSelectedId(d.runs?.[0]?.runId || null);
      })
      .catch((e) => setError(e.message));

  useEffect(() => { load(); }, [id]);

  useEffect(() => { setCopied(false); }, [selectedId]);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  if (error) return <div className="text-sm text-pb-err-text">{error}</div>;
  if (!data) return <div className="text-sm text-pb-subtle">Loading…</div>;

  const { deployment, runs } = data;
  const selected = runs.find((r) => r.runId === selectedId) || runs[0];
  const cfg = deployment.config || {};

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
      const next = !deployment.paused;
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
    if (!window.confirm(`Delete "${deployment.name || deployment.scriptId}"? This cannot be undone.`)) return;
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
      {/* Breadcrumb */}
      <div className="mb-3 text-[12.5px] text-pb-subtle">
        <Link to="/dashboard" className="hover:text-pb-dark">Scripts</Link>
        <span className="px-1.5">›</span>
        <span className="font-medium text-pb-dark">{deployment.name || deployment.scriptId}</span>
      </div>

      {/* Header */}
      <div className="mb-5 flex items-start justify-between">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <span className={`h-2 w-2 rounded-full ${
              deployment.paused ? 'bg-pb-subtle' :
              !selected          ? 'bg-pb-subtle' :
              selected.status === 'fail'    ? 'bg-pb-err' :
              selected.status === 'partial' ? 'bg-pb-amber' :
                                              'bg-pb-green'
            }`} />
            <h1 className="font-sans font-semibold text-[28px] tracking-tight text-pb-dark">
              {deployment.name || deployment.scriptId}
            </h1>
            {deployment.config?.dryRun !== undefined && (
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                deployment.config?.dryRun
                  ? 'bg-pb-warm text-pb-muted'
                  : 'bg-pb-err-bg text-pb-err-text'
              }`}>
                {deployment.config?.dryRun ? 'DRY RUN' : 'LIVE'}
              </span>
            )}
            <StatusBadge status={deployment.paused ? 'paused' : selected?.status || 'manual'} errorCount={selected?.errorCount} />
          </div>

          {/* Tree + meta row */}
          <div className="flex flex-wrap items-center gap-1.5">
            {cfg.parentType && (
              <TreeNode label={TYPE_LABELS[cfg.parentType] || cfg.parentType} isParent />
            )}
            {(cfg.childTypes || []).length > 0 && (
              <>
                <span className="text-[11px] text-pb-subtle">→</span>
                {cfg.childTypes.map((t) => (
                  <TreeNode key={t} label={TYPE_LABELS[t] || t} />
                ))}
              </>
            )}
            {cfg.fieldName && (
              <span className="ml-1 text-[12px] text-pb-subtle">
                · field{' '}
                <code className="rounded bg-pb-warm px-1.5 py-0.5 text-[11.5px] text-pb-dark">
                  {cfg.fieldName}
                </code>
              </span>
            )}
            <span className="ml-1 text-[12px] text-pb-subtle">· {deployment.schedule}</span>
            {selected && <span className="text-[12px] text-pb-subtle">· last ran {relativeTime(selected.startedAt)}</span>}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleRun}
            disabled={running}
            className="inline-flex items-center gap-1.5 rounded-lg bg-pb-dark px-3 py-2 text-[12.5px] font-medium text-pb-cream hover:bg-pb-dark/90 disabled:opacity-50"
          >
            <Play size={13} /> {running ? 'Running…' : 'Run now'}
          </button>
          <button
            onClick={() => navigate(`/scripts/${id}/edit`)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-pb-dark/[0.14] px-3 py-2 text-[12.5px] font-medium text-pb-dark hover:bg-pb-cream"
          >
            <Edit3 size={13} /> Edit
          </button>
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              disabled={busy}
              aria-label="More actions"
              className="rounded-lg border border-pb-dark/[0.14] px-2 py-2 text-pb-muted hover:bg-pb-cream disabled:opacity-50"
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
      </div>

      {/* Content grid */}
      <div className="grid min-h-0 flex-1 grid-cols-[300px_1fr] gap-4">
        {/* Run list */}
        <div className="overflow-hidden rounded-2xl border border-pb-dark/[0.08] bg-white">
          <div className="border-b border-pb-dark/[0.06] px-4 py-3 text-[10px] font-medium uppercase tracking-widest text-pb-subtle">
            Recent runs ({runs.length})
          </div>
          <div className="overflow-auto" style={{ maxHeight: 'calc(100% - 40px)' }}>
            {runs.length === 0 ? (
              <div className="p-4 text-[13px] text-pb-subtle">No runs yet.</div>
            ) : (
              <div className="p-1.5">
                {runs.map((r) => (
                  <RunRow
                    key={r.runId}
                    run={r}
                    selected={r.runId === selectedId}
                    onClick={() => setSelectedId(r.runId)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Log panel */}
        <div className="flex flex-col overflow-hidden rounded-2xl border border-pb-dark/[0.08] bg-white p-4">
          {selected ? (
            <>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-widest text-pb-subtle">
                    Run · {relativeTime(selected.startedAt)}
                  </div>
                  <div className="mt-0.5 font-sans font-semibold text-[17px] tracking-tight text-pb-dark">
                    {selected.status === 'ok'      ? 'Completed successfully' :
                     selected.status === 'partial' ? `Completed with ${selected.errorCount || 'some'} error${selected.errorCount === 1 ? '' : 's'}` :
                     selected.status === 'fail'    ? 'Run failed' :
                                                     selected.summary}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(selected.logs.join('\n'));
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      } catch {
                        toast.error('Copy failed');
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-pb-dark/[0.14] px-2.5 py-1.5 text-[11px] font-medium text-pb-muted hover:bg-pb-cream"
                  >
                    {copied ? <Check size={11} /> : <Copy size={11} />}
                    {copied ? 'Copied' : 'Copy logs'}
                  </button>
                  <span className="text-[11.5px] text-pb-subtle">
                    {(selected.durationMs / 1000).toFixed(1)}s
                  </span>
                </div>
              </div>
              <div className="min-h-0 flex-1">
                <LogPane logs={selected.logs} />
              </div>
            </>
          ) : (
            <div className="text-[13.5px] text-pb-subtle">
              Nothing to read yet — click Run to trigger one.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
