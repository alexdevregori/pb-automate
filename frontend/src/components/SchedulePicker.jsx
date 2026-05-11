const schedules = [
  { id: 'manual', label: 'Manual', desc: 'Run on demand only' },
  { id: 'daily',  label: 'Daily',  desc: 'Once per day at midnight UTC' },
];

export default function SchedulePicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {schedules.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onChange(s.id)}
          className={`rounded-xl border p-4 text-left transition-all ${
            value === s.id
              ? 'border-[1.5px] border-pb-dark bg-pb-cream'
              : 'border border-pb-dark/[0.12] bg-white hover:border-pb-dark/[0.25]'
          }`}
        >
          <div className="mb-1 text-[13.5px] font-medium text-pb-dark">{s.label}</div>
          <div className="text-[11.5px] text-pb-subtle">{s.desc}</div>
        </button>
      ))}
    </div>
  );
}
