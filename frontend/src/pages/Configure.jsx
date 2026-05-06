import { useState } from 'react';
import SchedulePicker from '../components/SchedulePicker';

export default function Configure({ scriptId, onContinue }) {
  const [fieldName, setFieldName] = useState('Status');
  const [schedule, setSchedule] = useState('manual');
  const [dryRun, setDryRun] = useState(true);
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [skipIfEmpty, setSkipIfEmpty] = useState(true);

  // Smoke-test script has no configurable fields — show a minimal Configure screen.
  if (scriptId === 'countFeatures') {
    return (
      <div>
        <h2 className="mb-1 text-xl font-bold text-pb-dark">Configure Script</h2>
        <p className="mb-6 text-sm text-gray-500">
          This is a read-only smoke test — no configuration needed. Pick a schedule and continue.
        </p>

        <div className="mb-6">
          <h3 className="mb-3 text-sm font-semibold text-pb-dark">Schedule</h3>
          <SchedulePicker value={schedule} onChange={setSchedule} />
        </div>

        <button
          onClick={() => onContinue({ config: { schedule } })}
          className="w-full rounded-lg bg-pb-blue px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-pb-blue/90"
        >
          Review &amp; Deploy
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-1 text-xl font-bold text-pb-dark">Configure Script</h2>
      <p className="mb-6 text-sm text-gray-500">
        Pick a field and a schedule. The script copies that field's value from every parent feature down to its children.
      </p>

      <div className="mb-6">
        <h3 className="mb-3 text-sm font-semibold text-pb-dark">Field name</h3>
        <input
          type="text"
          value={fieldName}
          onChange={(e) => setFieldName(e.target.value)}
          placeholder="e.g. Status"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-pb-blue focus:outline-none focus:ring-1 focus:ring-pb-blue"
        />
        <p className="mt-1 text-xs text-gray-500">
          The custom field must exist on both the parent and its children with this exact name.
        </p>
      </div>

      <div className="mb-6">
        <h3 className="mb-3 text-sm font-semibold text-pb-dark">Schedule</h3>
        <SchedulePicker value={schedule} onChange={setSchedule} />
      </div>

      <div className="mb-6">
        <h3 className="mb-3 text-sm font-semibold text-pb-dark">Options</h3>
        <div className="space-y-3">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-pb-blue focus:ring-pb-blue"
            />
            <div>
              <div className="text-sm font-medium text-gray-700">Dry run (preview only)</div>
              <div className="text-xs text-gray-500">
                Logs what would change without writing to Productboard. Recommended for first run.
              </div>
            </div>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={overwriteExisting}
              onChange={(e) => setOverwriteExisting(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-pb-blue focus:ring-pb-blue"
            />
            <span className="text-sm text-gray-700">Overwrite existing values on children</span>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={skipIfEmpty}
              onChange={(e) => setSkipIfEmpty(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-pb-blue focus:ring-pb-blue"
            />
            <span className="text-sm text-gray-700">Skip when parent's field is empty</span>
          </label>
        </div>
      </div>

      <button
        onClick={() =>
          onContinue({
            config: {
              fieldName,
              schedule,
              dryRun,
              overwriteExisting,
              skipIfEmpty,
            },
          })
        }
        className="w-full rounded-lg bg-pb-blue px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-pb-blue/90"
      >
        Review &amp; Deploy
      </button>
    </div>
  );
}
