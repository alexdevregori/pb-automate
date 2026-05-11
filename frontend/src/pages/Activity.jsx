import { useEffect, useState, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { getScripts } from '../lib/api';
import LogPane from '../components/LogPane';
import { relativeTime } from '../lib/relativeTime';

function dayLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function Activity() {
  const [data, setData] = useState({ scripts: [], deployments: [] });
  const [loading, setLoading] = useState(true);
  const [expandedRun, setExpandedRun] = useState(null);
  const [filterScript, setFilterScript] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    getScripts()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const runs = useMemo(() => {
    const flat = (data.deployments || []).flatMap((d) =>
      (d.recentRuns || []).map((r) => ({
        ...r,
        deploymentName: d.name,
      }))
    );
    flat.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    return flat;
  }, [data.deployments]);

  const filtered = useMemo(() => runs.filter((r) => {
    if (filterScript !== 'all' && r.deploymentId !== filterScript) return false;
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    return true;
  }), [runs, filterScript, filterStatus]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const r of filtered) {
      const label = dayLabel(r.startedAt);
      if (!map.has(label)) map.set(label, []);
      map.get(label).push(r);
    }
    return [...map.entries()];
  }, [filtered]);

  const deployments = data.deployments || [];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="mb-1 font-sans font-semibold text-3xl tracking-tight text-pb-dark">Activity</h1>
        <p className="text-[13.5px] text-pb-muted">Every script run across your workspace.</p>
      </div>

      <div className="mb-5 flex gap-2">
        <select
          value={filterScript}
          onChange={(e) => setFilterScript(e.target.value)}
          className="rounded-lg border border-pb-cream-dk bg-white px-3 py-1.5 text-[13px] text-pb-dark focus:outline-none focus:ring-2 focus:ring-pb-dark/20"
        >
          <option value="all">All scripts</option>
          {deployments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-pb-cream-dk bg-white px-3 py-1.5 text-[13px] text-pb-dark focus:outline-none focus:ring-2 focus:ring-pb-dark/20"
        >
          <option value="all">All statuses</option>
          <option value="ok">Healthy</option>
          <option value="partial">Partial</option>
          <option value="fail">Failed</option>
        </select>
      </div>

      {loading ? (
        <div className="text-[13.5px] text-pb-subtle">Loading…</div>
      ) : groups.length === 0 ? (
        <div className="rounded-xl border border-pb-cream-dk bg-white p-10 text-center text-[13.5px] text-pb-subtle">
          No runs yet.
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(([label, groupRuns]) => (
            <section key={label}>
              <div className="mb-2 flex items-center gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-pb-subtle">{label}</span>
                <div className="h-px flex-1 bg-pb-cream-dk" />
              </div>
              <div className="overflow-hidden rounded-xl border border-pb-cream-dk bg-white divide-y divide-pb-cream-dk">
                {groupRuns.map((run) => (
                  <ActivityRow
                    key={run.runId}
                    run={run}
                    expanded={expandedRun === run.runId}
                    onToggle={() => setExpandedRun(expandedRun === run.runId ? null : run.runId)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

const statusDot = {
  ok:      'bg-pb-green',
  partial: 'bg-pb-amber',
  fail:    'bg-pb-err',
};

const summaryColor = {
  ok:      'text-pb-muted',
  partial: 'text-pb-amber-text',
  fail:    'text-pb-err-text',
};

function ActivityRow({ run, expanded, onToggle }) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="grid w-full grid-cols-[8px_1fr_auto_auto_16px] items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-pb-cream/60"
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${statusDot[run.status] || 'bg-pb-subtle'}`} />
        <div className="min-w-0">
          <span className="block truncate text-[13.5px] font-medium text-pb-dark">{run.deploymentName}</span>
          <span className={`block truncate text-[12px] ${summaryColor[run.status] || 'text-pb-muted'}`}>
            {run.summary}
          </span>
        </div>
        <span className="whitespace-nowrap text-[12px] text-pb-subtle">{(run.durationMs / 1000).toFixed(1)}s</span>
        <span className="whitespace-nowrap text-[12px] text-pb-subtle">{relativeTime(run.startedAt)}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-pb-subtle transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
      {expanded && (
        <div className="h-52 px-5 pb-4">
          <LogPane logs={run.logs || []} />
        </div>
      )}
    </div>
  );
}
