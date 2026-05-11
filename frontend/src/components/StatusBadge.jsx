const styles = {
  ok:      'bg-pb-green-bg text-pb-green-text',
  partial: 'bg-pb-err-bg text-pb-err-text',
  fail:    'bg-pb-err-bg text-pb-err-text',
  manual:  'bg-pb-warm text-pb-muted',
  paused:  'bg-pb-warm text-pb-muted',
};

const dots = {
  ok:      'bg-pb-green',
  partial: 'bg-pb-amber',
  fail:    'bg-pb-err',
  manual:  'bg-pb-subtle',
  paused:  'bg-pb-subtle',
};

export default function StatusBadge({ status, errorCount }) {
  let label;
  if (status === 'ok') label = 'Healthy';
  else if (status === 'partial') label = errorCount ? `${errorCount} error${errorCount === 1 ? '' : 's'}` : 'errors';
  else if (status === 'fail') label = 'Failed';
  else if (status === 'manual') label = 'Manual';
  else if (status === 'paused') label = 'Paused';
  else label = status;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${styles[status] || styles.manual}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dots[status] || dots.manual}`} />
      {label}
    </span>
  );
}
