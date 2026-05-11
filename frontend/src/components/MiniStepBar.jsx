import { Check } from 'lucide-react';

const steps = ['Configure', 'Deploy', 'Done'];

export default function MiniStepBar({ current }) {
  return (
    <div className="mb-8 flex items-center justify-center gap-3">
      {steps.map((label, i) => {
        const n = i + 1;
        const active = n === current;
        const done = n < current;
        return (
          <div key={label} className="flex items-center gap-2.5">
            {i > 0 && (
              <div className={`h-px w-10 ${done ? 'bg-pb-dark/30' : 'bg-pb-dark/[0.12]'}`} />
            )}
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-medium ${
                active
                  ? 'border border-pb-err-text bg-pb-err-bg text-pb-err-text'
                  : done
                    ? 'bg-pb-dark text-pb-cream'
                    : 'bg-pb-warm text-pb-subtle'
              }`}
            >
              {done ? <Check size={13} /> : n}
            </div>
            <span className={`text-[13px] font-medium ${active ? 'text-pb-dark' : done ? 'text-pb-muted' : 'text-pb-subtle'}`}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
