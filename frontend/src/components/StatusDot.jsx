export default function StatusDot({ status, className = '' }) {
  const color = {
    ok: 'bg-emerald-500',
    fail: 'bg-red-500',
    paused: 'bg-gray-400',
    manual: 'bg-gray-400',
  }[status] || 'bg-gray-400';
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${color} ${className}`} />;
}
