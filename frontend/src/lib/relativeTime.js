const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;

export function relativeTime(input, now = Date.now()) {
  const t = typeof input === 'string' ? Date.parse(input) : input;
  if (!Number.isFinite(t)) return '—';
  const diff = now - t;
  if (diff < 0) return 'just now';
  if (diff < MIN) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < HOUR) return `${Math.floor(diff / MIN)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  return `${Math.floor(diff / DAY)}d ago`;
}
