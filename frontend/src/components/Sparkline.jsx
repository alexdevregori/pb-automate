export default function Sparkline({ runs = [], max = 7 }) {
  const recent = runs.slice(0, max).reverse();
  if (recent.length === 0) return <span className="text-xs text-pb-subtle">No runs yet</span>;
  return (
    <div className="flex items-end gap-0.5" style={{ height: 22 }}>
      {recent.map((r, i) => {
        const heights = [75, 92, 58, 83, 67, 100, 50];
        const h = heights[i % heights.length];
        const color =
          r.status === 'fail'    ? 'bg-pb-err' :
          r.status === 'partial' ? 'bg-pb-amber' :
                                   'bg-pb-green';
        return (
          <span
            key={r.runId || i}
            className={`${color} rounded-sm`}
            style={{ width: 4, height: `${h}%` }}
          />
        );
      })}
    </div>
  );
}
