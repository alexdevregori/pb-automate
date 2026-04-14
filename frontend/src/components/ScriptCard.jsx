import React from 'react';

const icons = {
  sync: '🔄',
  rollup: '📊',
  tags: '🏷️',
  custom: '⚙️',
};

export default function ScriptCard({ id, title, description, icon, selected, onSelect }) {
  return (
    <button
      onClick={() => onSelect(id)}
      className={`rounded-xl border-2 p-5 text-left transition-all ${
        selected
          ? 'border-pb-blue bg-white shadow-md'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <div className="mb-3 text-2xl">{icons[icon] || '📦'}</div>
      <h3 className="mb-1 text-sm font-semibold text-pb-dark">{title}</h3>
      <p className="text-xs text-gray-500">{description}</p>
      {selected && (
        <div className="mt-3 inline-block rounded-full bg-pb-blue/10 px-2.5 py-0.5 text-xs font-medium text-pb-blue">
          Selected
        </div>
      )}
    </button>
  );
}
