import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StepBar from '../components/StepBar';
import ScriptCard from '../components/ScriptCard';

const scripts = [
  {
    id: 'syncField',
    title: 'Sync Custom Field',
    description: 'Sync a custom field value between parent and child features automatically.',
    icon: 'sync',
  },
  {
    id: 'rollupScore',
    title: 'Roll Up Priority Score',
    description: 'Aggregate child priority scores to the parent feature level.',
    icon: 'rollup',
  },
  {
    id: 'propagateTags',
    title: 'Propagate Tags',
    description: 'Copy tags from parent features down to all child sub-features.',
    icon: 'tags',
  },
  {
    id: 'custom',
    title: 'Custom Script',
    description: 'Upload or write your own automation script for advanced use cases.',
    icon: 'custom',
  },
];

export default function Picker() {
  const [selected, setSelected] = useState('syncField');
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <StepBar current={2} />
      <div className="rounded-2xl bg-white p-8 shadow-sm">
        <h2 className="mb-1 text-xl font-bold text-pb-dark">Choose a Script</h2>
        <p className="mb-6 text-sm text-gray-500">
          Select an automation script to configure and deploy.
        </p>

        <div className="mb-6 grid grid-cols-2 gap-4">
          {scripts.map((s) => (
            <ScriptCard
              key={s.id}
              {...s}
              selected={selected === s.id}
              onSelect={setSelected}
            />
          ))}
        </div>

        <button
          onClick={() => navigate('/configure', { state: { scriptId: selected } })}
          className="w-full rounded-lg bg-pb-blue px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-pb-blue/90"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
