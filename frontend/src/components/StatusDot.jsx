export default function StatusDot({ status, className = '' }) {
  const color = {
    ok:      'bg-pb-green',
    partial: 'bg-pb-amber',
    fail:    'bg-pb-err',
    paused:  'bg-pb-subtle',
    manual:  'bg-pb-subtle',
  }[status] || 'bg-pb-subtle';
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${color} ${className}`} />;
}
