import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import StepBar from '../components/StepBar';
import FieldMapper from '../components/FieldMapper';
import SchedulePicker from '../components/SchedulePicker';

export default function Configure() {
  const navigate = useNavigate();
  const location = useLocation();
  const scriptId = location.state?.scriptId || 'syncField';

  const [config, setConfig] = useState({
    sourceEntity: 'Feature',
    sourceField: 'Status',
    targetEntity: 'Sub-feature',
    targetField: 'Status',
  });

  const [direction, setDirection] = useState('parent-to-children');
  const [schedule, setSchedule] = useState('daily');
  const [overwriteExisting, setOverwriteExisting] = useState(true);
  const [skipIfEmpty, setSkipIfEmpty] = useState(true);
  const [logChanges, setLogChanges] = useState(true);

  const handleContinue = () => {
    navigate('/deploy', {
      state: {
        scriptId,
        config: {
          ...config,
          direction,
          schedule,
          overwriteExisting,
          skipIfEmpty,
          logChanges,
        },
      },
    });
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <StepBar current={3} />
      <div className="rounded-2xl bg-white p-8 shadow-sm">
        <h2 className="mb-1 text-xl font-bold text-pb-dark">Configure Script</h2>
        <p className="mb-6 text-sm text-gray-500">
          Set up field mapping, direction, and schedule.
        </p>

        <div className="mb-6">
          <h3 className="mb-3 text-sm font-semibold text-pb-dark">Field Mapping</h3>
          <FieldMapper config={config} onChange={setConfig} />
        </div>

        <div className="mb-6">
          <h3 className="mb-3 text-sm font-semibold text-pb-dark">Direction</h3>
          <div className="flex gap-2">
            {[
              { id: 'parent-to-children', label: 'Parent → Children' },
              { id: 'children-to-parent', label: 'Children → Parent' },
              { id: 'bidirectional', label: 'Bidirectional' },
            ].map((d) => (
              <button
                key={d.id}
                onClick={() => setDirection(d.id)}
                className={`rounded-lg border-2 px-4 py-2 text-xs font-medium transition-all ${
                  direction === d.id
                    ? 'border-pb-blue bg-pb-blue/5 text-pb-blue'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <h3 className="mb-3 text-sm font-semibold text-pb-dark">Schedule</h3>
          <SchedulePicker value={schedule} onChange={setSchedule} />
        </div>

        <div className="mb-6">
          <h3 className="mb-3 text-sm font-semibold text-pb-dark">Options</h3>
          <div className="space-y-3">
            {[
              { label: 'Overwrite existing values', value: overwriteExisting, setter: setOverwriteExisting },
              { label: 'Skip if source is empty', value: skipIfEmpty, setter: setSkipIfEmpty },
              { label: 'Log all changes', value: logChanges, setter: setLogChanges },
            ].map((opt) => (
              <label key={opt.label} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={opt.value}
                  onChange={(e) => opt.setter(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-pb-blue focus:ring-pb-blue"
                />
                <span className="text-sm text-gray-700">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        <button
          onClick={handleContinue}
          className="w-full rounded-lg bg-pb-blue px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-pb-blue/90"
        >
          Review & Deploy
        </button>
      </div>
    </div>
  );
}
