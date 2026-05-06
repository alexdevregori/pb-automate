import { useEffect, useState } from 'react';
import SchedulePicker from '../components/SchedulePicker';
import { getAvailableFields } from '../lib/api';

export default function Configure({ scriptId, onContinue }) {
  const [fieldName, setFieldName] = useState('');
  const [schedule, setSchedule] = useState('manual');
  const [dryRun, setDryRun] = useState(true);
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [skipIfEmpty, setSkipIfEmpty] = useState(true);

  // Fetch the available fields from PB so the user picks from a real list
  // instead of typing. Falls back to a text input if the call fails.
  const [fields, setFields] = useState(null);   // null = loading, [] = none, [...] = options
  const [fieldsError, setFieldsError] = useState(null);

  useEffect(() => {
    if (scriptId !== 'syncField') return;
    getAvailableFields()
      .then((res) => {
        const list = res.fields || [];
        setFields(list);
        if (list.length && !fieldName) setFieldName(list[0].name);
      })
      .catch((err) => setFieldsError(err.message));
  }, [scriptId]);

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
        <h3 className="mb-3 text-sm font-semibold text-pb-dark">Field</h3>
        {fieldsError ? (
          <>
            <input
              type="text"
              value={fieldName}
              onChange={(e) => setFieldName(e.target.value)}
              placeholder="e.g. Status"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-pb-blue focus:outline-none focus:ring-1 focus:ring-pb-blue"
            />
            <p className="mt-1 text-xs text-amber-700">
              Couldn't load field list from Productboard ({fieldsError}). Type the name manually — it must match exactly.
            </p>
          </>
        ) : fields === null ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
            Loading fields from Productboard…
          </div>
        ) : fields.length === 0 ? (
          <p className="text-xs text-gray-500">
            No fields are available on both feature and sub-feature. Add a custom field to your workspace and try again.
          </p>
        ) : (
          <>
            <select
              value={fieldName}
              onChange={(e) => setFieldName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-pb-blue focus:outline-none focus:ring-1 focus:ring-pb-blue"
            >
              {fields.map((f) => (
                <option key={f.key} value={f.name}>
                  {f.name}
                  {f.kind === 'custom' ? ' (custom)' : ''}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Showing fields that exist on both feature and sub-feature in your workspace.
            </p>
          </>
        )}
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
        disabled={!fieldName.trim()}
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
        className="w-full rounded-lg bg-pb-blue px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-pb-blue/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Review &amp; Deploy
      </button>
    </div>
  );
}
