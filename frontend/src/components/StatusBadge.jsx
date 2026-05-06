import StatusDot from './StatusDot';

const styles = {
  ok: 'bg-emerald-50 text-emerald-700',
  fail: 'bg-red-50 text-red-700',
  manual: 'bg-gray-100 text-gray-600',
  paused: 'bg-gray-100 text-gray-600',
};

const labels = { ok: 'OK', fail: 'FAILED', manual: 'MANUAL', paused: 'PAUSED' };

export default function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${styles[status] || styles.manual}`}>
      <StatusDot status={status} />
      {labels[status] || 'UNKNOWN'}
    </span>
  );
}
