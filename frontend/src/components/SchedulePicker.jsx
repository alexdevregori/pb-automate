import React from 'react';

const schedules = [
  { id: 'on-change', label: 'On Change', desc: 'Triggered by webhooks' },
  { id: 'hourly', label: 'Hourly', desc: 'Every hour' },
  { id: 'daily', label: 'Daily', desc: 'Once per day at midnight UTC' },
  { id: 'manual', label: 'Manual', desc: 'Run on demand only' },
];

export default function SchedulePicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {schedules.map((s) => (
        <button
          key={s.id}
          onClick={() => onChange(s.id)}
          className={`rounded-lg border-2 p-3 text-left transition-all ${
            value === s.id
              ? 'border-pb-blue bg-pb-blue/5'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="text-sm font-medium text-pb-dark">{s.label}</div>
          <div className="text-xs text-gray-500">{s.desc}</div>
        </button>
      ))}
    </div>
  );
}
