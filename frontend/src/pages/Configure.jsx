import { useEffect, useState } from 'react';
import SchedulePicker from '../components/SchedulePicker';
import { getAvailableFields, getHierarchy } from '../lib/api';

const TYPE_LABELS = {
  product: 'Product',
  component: 'Component',
  feature: 'Feature',
  subfeature: 'Sub-feature',
  release: 'Release',
  initiative: 'Initiative',
  objective: 'Objective',
  keyResult: 'Key Result',
};

const labelOf = (t) => TYPE_LABELS[t] || t;

export default function Configure({ scriptId, onContinue }) {
  // ---- countFeatures (no config beyond schedule) ----
  if (scriptId === 'countFeatures') {
    return <CountFeaturesConfigure onContinue={onContinue} />;
  }

  return <SyncFieldConfigure onContinue={onContinue} />;
}

function CountFeaturesConfigure({ onContinue }) {
  const [schedule, setSchedule] = useState('manual');
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

function SyncFieldConfigure({ onContinue }) {
  // Hierarchy + form state
  const [hierarchy, setHierarchy] = useState(null);
  const [hierarchyError, setHierarchyError] = useState(null);

  const [parentType, setParentType] = useState('feature');
  const [childTypes, setChildTypes] = useState([]); // multi-select
  const [fieldName, setFieldName] = useState('');
  const [schedule, setSchedule] = useState('manual');
  const [dryRun, setDryRun] = useState(true);
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [skipIfEmpty, setSkipIfEmpty] = useState(true);

  // Field list state
  const [fields, setFields] = useState(null); // null=loading, []=none, [...]=options
  const [fieldsError, setFieldsError] = useState(null);

  // 1. Load the hierarchy once.
  useEffect(() => {
    getHierarchy()
      .then((res) => {
        setHierarchy(res.hierarchy);
        const firstParent = Object.keys(res.hierarchy)[0];
        setParentType(firstParent);
        setChildTypes(res.hierarchy[firstParent] || []);
      })
      .catch((err) => setHierarchyError(err.message));
  }, []);

  // 2. When parentType changes, reset childTypes to all valid children of that parent.
  useEffect(() => {
    if (!hierarchy) return;
    setChildTypes(hierarchy[parentType] || []);
  }, [parentType, hierarchy]);

  // 3. Re-fetch field list when parentType or childTypes change.
  useEffect(() => {
    if (!parentType || !childTypes.length) {
      setFields([]);
      return;
    }
    setFields(null); // loading
    setFieldsError(null);
    getAvailableFields({ parentType, childTypes })
      .then((res) => {
        const list = res.fields || [];
        setFields(list);
        // Keep current selection if still valid; otherwise pick first.
        if (list.length && !list.some((f) => f.name === fieldName)) {
          setFieldName(list[0].name);
        }
        if (!list.length) setFieldName('');
      })
      .catch((err) => {
        setFieldsError(err.message);
        setFields([]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentType, childTypes.join('|')]);

  const validChildren = hierarchy ? hierarchy[parentType] || [] : [];
  const canContinue = !!fieldName.trim() && childTypes.length > 0;

  const toggleChildType = (t) => {
    setChildTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  };

  if (hierarchyError) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        Couldn't load hierarchy: {hierarchyError}
      </div>
    );
  }
  if (!hierarchy) {
    return <div className="text-sm text-gray-500">Loading…</div>;
  }

  return (
    <div>
      <h2 className="mb-1 text-xl font-bold text-pb-dark">Configure Script</h2>
      <p className="mb-6 text-sm text-gray-500">
        Pick a parent entity type, the child types to sync into, and a field. The script copies the parent's value down to all matching descendants.
      </p>

      <div className="mb-6">
        <h3 className="mb-3 text-sm font-semibold text-pb-dark">Parent type</h3>
        <select
          value={parentType}
          onChange={(e) => setParentType(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-pb-blue focus:outline-none focus:ring-1 focus:ring-pb-blue"
        >
          {Object.keys(hierarchy).map((t) => (
            <option key={t} value={t}>{labelOf(t)}</option>
          ))}
        </select>
      </div>

      <div className="mb-6">
        <h3 className="mb-3 text-sm font-semibold text-pb-dark">Child types</h3>
        <div className="space-y-2 rounded-lg border border-gray-200 p-3">
          {validChildren.map((t) => (
            <label key={t} className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={childTypes.includes(t)}
                onChange={() => toggleChildType(t)}
                className="h-4 w-4 rounded border-gray-300 text-pb-blue focus:ring-pb-blue"
              />
              <span className="text-sm text-gray-700">{labelOf(t)}</span>
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-gray-500">
          The script walks descendants recursively, so picking only top-level types still reaches deep ones via their parents.
        </p>
      </div>

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
              Couldn't load field list ({fieldsError}). Type the name manually.
            </p>
          </>
        ) : fields === null ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
            Loading fields…
          </div>
        ) : fields.length === 0 ? (
          <p className="text-xs text-gray-500">
            No common fields found across the selected types. Pick at least one child type whose schema overlaps with the parent.
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
                  {f.name}{f.kind === 'custom' ? ' (custom)' : ''}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Showing fields that exist on every selected type.
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
        disabled={!canContinue}
        onClick={() =>
          onContinue({
            config: {
              parentType,
              childTypes,
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
