import StatusBadge from './StatusBadge';
import { relativeTime } from '../lib/relativeTime';

const dotColor = {
  ok:      'bg-pb-green',
  partial: 'bg-pb-amber',
  fail:    'bg-pb-err',
  manual:  'bg-pb-subtle',
  paused:  'bg-pb-subtle',
};

export default function RunRow({ run, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`grid w-full grid-cols-[20px_1fr_auto_auto] items-center gap-3 rounded-lg px-4 py-3.5 text-left text-[11px] transition-colors ${
        selected
          ? 'bg-pb-cream shadow-[inset_3px_0_0_#0A1F44]'
          : 'hover:bg-pb-dark/[0.03]'
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${dotColor[run.status] || 'bg-pb-subtle'}`} />
      <div className="overflow-hidden">
        <div className="truncate text-[13px] font-medium text-pb-dark">{relativeTime(run.startedAt)}</div>
        <div className={`truncate text-[11.5px] ${
          run.status === 'fail'    ? 'text-pb-err-text' :
          run.status === 'partial' ? 'text-pb-amber-text' :
                                     'text-pb-subtle'
        }`}>
          {run.summary}
        </div>
      </div>
      <StatusBadge status={run.status} errorCount={run.errorCount} />
      <span className="text-[11.5px] text-pb-subtle">{(run.durationMs / 1000).toFixed(1)}s</span>
    </button>
  );
}
