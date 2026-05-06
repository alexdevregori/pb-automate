export default function LogPane({ logs = [] }) {
  if (!logs.length) return <div className="text-xs text-gray-400">No log lines.</div>;
  return (
    <pre className="max-h-full overflow-auto rounded-md bg-pb-dark p-3 font-mono text-[10px] leading-relaxed text-emerald-400">
      {logs.map((l, i) => {
        const isErr = /error|fail|exception/i.test(l);
        return <div key={i} className={isErr ? 'text-red-400' : ''}>{l}</div>;
      })}
    </pre>
  );
}
