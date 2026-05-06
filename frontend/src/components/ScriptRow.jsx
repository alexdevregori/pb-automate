import { useNavigate } from 'react-router-dom';
import { Play, MoreHorizontal } from 'lucide-react';
import StatusDot from './StatusDot';
import StatusBadge from './StatusBadge';
import Sparkline from './Sparkline';
import { relativeTime } from '../lib/relativeTime';

export default function ScriptRow({ deployment }) {
  const navigate = useNavigate();
  const latestRun = deployment.latestRun;
  const recentRuns = deployment.recentRuns || [];

  const status = !latestRun ? 'manual' : latestRun.status;
  const scheduleLabel =
    deployment.schedule === 'manual' ? 'Manual trigger' :
    deployment.schedule === 'on-change' ? 'On webhook event' :
    `${deployment.schedule}`;

  const lastRunLine = !latestRun
    ? 'Never run'
    : latestRun.status === 'fail'
      ? `${relativeTime(latestRun.startedAt)} · ${latestRun.error || latestRun.summary}`
      : `${relativeTime(latestRun.startedAt)} · ${latestRun.summary}`;

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
        <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50">
            <Play size={12} className="mr-1 inline" /> Run
          </button>
          <button className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50">
            <MoreHorizontal size={12} />
          </button>
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
