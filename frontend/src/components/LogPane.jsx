export default function LogPane({ logs = [] }) {
  if (!logs.length) return <div className="text-xs text-pb-subtle">No log lines.</div>;
  return (
    <div className="h-full overflow-auto rounded-lg bg-pb-dark p-4 font-mono text-[12px] leading-[1.7]">
      {logs.map((line, i) => <LogLine key={i} line={line} />)}
    </div>
  );
}

function LogLine({ line }) {
  if (/^\[ERROR\]/i.test(line))   return <div className="text-red-400">{line}</div>;
  if (/^\[skip\]/i.test(line))    return <div className="text-slate-500">{line}</div>;
  if (/^\[process\]/i.test(line)) return <div className="text-amber-400">{line}</div>;
  if (/^\[diag\]/i.test(line))    return <div className="italic text-slate-600">{line}</div>;
  return <div className="text-emerald-400">{line}</div>;
}
