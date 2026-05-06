import StatusDot from './StatusDot';
import StatusBadge from './StatusBadge';
import { relativeTime } from '../lib/relativeTime';

export default function RunRow({ run, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`grid w-full grid-cols-[12px_1fr_auto_auto] items-center gap-2 border-b border-gray-100 px-3 py-2 text-left text-[11px] last:border-b-0 ${
        selected ? 'bg-indigo-50' : 'hover:bg-gray-50'
      }`}
    >
      <StatusDot status={run.status} />
      <div className="overflow-hidden">
        <div className="truncate font-medium text-pb-dark">{relativeTime(run.startedAt)}</div>
        <div className={`truncate ${run.status === 'fail' ? 'text-red-700' : 'text-gray-500'}`}>
          {run.summary}
        </div>
      </div>
      <StatusBadge status={run.status} />
      <span className="text-[10px] text-gray-400">{(run.durationMs / 1000).toFixed(1)}s</span>
    </button>
  );
}
