export default function Sparkline({ runs = [], max = 7 }) {
  const recent = runs.slice(0, max).reverse();
  if (recent.length === 0) return <span className="text-xs text-gray-400">No runs yet</span>;
  return (
    <div className="flex items-end gap-0.5" style={{ height: 22 }}>
      {recent.map((r, i) => {
        const height = 40 + ((i * 13) % 50);
        const color = r.status === 'fail' ? 'bg-red-500' : 'bg-emerald-500';
        return (
          <span
            key={r.runId || i}
            className={`${color} rounded-sm`}
            style={{ width: 4, height: `${height}%` }}
          />
        );
      })}
    </div>
  );
}
