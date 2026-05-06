const steps = ['Configure', 'Deploy', 'Done'];

export default function MiniStepBar({ current }) {
  return (
    <div className="mb-6 flex items-center justify-center gap-2">
      {steps.map((label, i) => {
        const n = i + 1;
        const active = n === current;
        const done = n < current;
        return (
          <div key={label} className="flex items-center gap-1.5">
            {i > 0 && <div className={`h-px w-8 ${done ? 'bg-pb-blue' : 'bg-gray-300'}`} />}
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                active
                  ? 'bg-pb-blue text-white'
                  : done
                    ? 'bg-pb-blue/20 text-pb-blue'
                    : 'bg-gray-200 text-gray-500'
              }`}
            >
              {done ? '✓' : n}
            </div>
            <span className={`text-xs font-medium ${active ? 'text-pb-dark' : 'text-gray-400'}`}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
