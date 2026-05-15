import { useEffect, useRef, useState } from 'react';
import SchedulePicker from '../../components/SchedulePicker';
import { getAvailableFields, getHierarchy } from '../../lib/api';

function deriveFieldType(schema = {}) {
  if (schema.required?.includes('id') && schema.required?.includes('email')) return 'Member';
  if (schema.type === 'string' && schema.format === 'date') return 'Date';
  if (schema.type === 'string' && schema.constraints?.maxLength === 1048576) return 'Description';
  if (schema.type === 'string') return 'Text';
  if (schema.type === 'array') return 'Multi-select';
  if (schema.type === 'object') return 'Single select';
  if (schema.type === 'number' || schema.type === 'integer') return 'Number';
  return schema.type ? schema.type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Other';
}

function groupFields(fields) {
  const grouped = new Map();
  for (const f of fields) {
    const type = deriveFieldType(f.schema);
    if (!grouped.has(type)) grouped.set(type, []);
    grouped.get(type).push(f);
  }
  return [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([type, groupFields]) => ({
      type,
      fields: [...groupFields].sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

const TYPE_LABELS = {
  product: 'Product', component: 'Component', feature: 'Feature',
  subfeature: 'Sub-feature', release: 'Release', initiative: 'Initiative',
  objective: 'Objective', keyResult: 'Key Result',
};

const labelOf = (t) => TYPE_LABELS[t] || t;

const inputCls = 'w-full rounded-lg border border-pb-dark/[0.14] bg-white px-3 py-2.5 text-[13.5px] text-pb-dark transition-all placeholder:text-pb-subtle focus:border-pb-dark focus:outline-none focus:ring-2 focus:ring-pb-dark/[0.08]';
const sectionHeadCls = 'mb-2 block text-[12.5px] font-medium text-pb-dark';

export default function SyncFieldConfigure({ initialConfig, onContinue, submitLabel = 'Preview run' }) {
  const [hierarchy, setHierarchy] = useState(null);
  const [hierarchyError, setHierarchyError] = useState(null);

  const [name, setName] = useState(initialConfig?.name || '');
  const [parentType, setParentType] = useState(initialConfig?.parentType || 'feature');
  const [childTypes, setChildTypes] = useState(initialConfig?.childTypes || []);
  const [fieldName, setFieldName] = useState(initialConfig?.fieldName || '');
  const [schedule, setSchedule] = useState(initialConfig?.schedule || 'manual');
  const [dryRun, setDryRun] = useState(initialConfig?.dryRun ?? true);
  const [overwriteExisting, setOverwriteExisting] = useState(initialConfig?.overwriteExisting ?? false);
  const [skipIfEmpty, setSkipIfEmpty] = useState(initialConfig?.skipIfEmpty ?? true);

  const [fields, setFields] = useState(null);
  const [fieldsError, setFieldsError] = useState(null);
  const [fieldsRefreshKey, setFieldsRefreshKey] = useState(0);

  const userChangedParent = useRef(false);

  useEffect(() => {
    getHierarchy()
      .then((res) => {
        setHierarchy(res.hierarchy);
        if (!initialConfig) {
          const firstParent = Object.keys(res.hierarchy)[0];
          setParentType(firstParent);
          setChildTypes(res.hierarchy[firstParent] || []);
        }
      })
      .catch((err) => setHierarchyError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hierarchy || !userChangedParent.current) return;
    setChildTypes(hierarchy[parentType] || []);
  }, [parentType, hierarchy]);

  useEffect(() => {
    if (!parentType || !childTypes.length) { setFields([]); return; }
    setFields(null);
    setFieldsError(null);
    getAvailableFields({ parentType, childTypes })
      .then((res) => {
        const list = res.fields || [];
        setFields(list);
        if (!list.some((f) => f.name === fieldName)) setFieldName('');
      })
      .catch((err) => { setFieldsError(err.message); setFields([]); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentType, childTypes.join('|'), fieldsRefreshKey]);

  const validChildren = hierarchy ? hierarchy[parentType] || [] : [];
  const canContinue = !!name.trim() && !!fieldName.trim() && childTypes.length > 0;

  const toggleChildType = (t) =>
    setChildTypes((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);

  if (hierarchyError) {
    return (
      <div className="rounded-lg border border-pb-err-bg bg-pb-err-bg/50 p-4 text-sm text-pb-err-text">
        Couldn't load hierarchy: {hierarchyError}
      </div>
    );
  }
  if (!hierarchy) {
    return <div className="text-[13.5px] text-pb-subtle">Loading…</div>;
  }

  return (
    <div>
      <h2 className="mb-1 font-sans font-semibold text-2xl tracking-tight text-pb-dark">
        {initialConfig ? 'Edit script' : 'Configure script'}
      </h2>
      <p className="mb-6 text-[13.5px] text-pb-muted">
        Pick a parent entity type, the child types to sync into, and a field. The script copies the parent's value down to all matching descendants.
      </p>

      {/* Name */}
      <div className="mb-5">
        <label className={sectionHeadCls}>
          Name <span className="font-normal text-pb-subtle">— shown in scripts list</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Sync Dev Lead to features"
          className={inputCls}
        />
      </div>

      {/* Parent type */}
      <div className="mb-5">
        <label className={sectionHeadCls}>
          Parent type <span className="font-normal text-pb-subtle">— where the value lives</span>
        </label>
        <div className="relative">
          <select
            value={parentType}
            onChange={(e) => {
              userChangedParent.current = true;
              setParentType(e.target.value);
            }}
            className={`${inputCls} appearance-none pr-9`}
          >
            {Object.keys(hierarchy).map((t) => (
              <option key={t} value={t}>{labelOf(t)}</option>
            ))}
          </select>
          <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-pb-subtle" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
        </div>
      </div>

      {/* Child types */}
      <div className="mb-5">
        <label className={sectionHeadCls}>
          Child types <span className="font-normal text-pb-subtle">— where the value gets copied</span>
        </label>
        <div className="rounded-lg border border-pb-dark/[0.14] bg-white p-1">
          {validChildren.map((t) => (
            <label
              key={t}
              className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-pb-cream/70"
            >
              <span className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] ${
                childTypes.includes(t) ? 'bg-pb-dark text-pb-cream' : 'border-[1.5px] border-pb-dark/[0.22]'
              }`}>
                {childTypes.includes(t) && (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
                )}
              </span>
              <span className="flex-1 text-[13.5px] text-pb-dark">{labelOf(t)}</span>
              <input type="checkbox" checked={childTypes.includes(t)} onChange={() => toggleChildType(t)} className="sr-only" />
            </label>
          ))}
        </div>
        <p className="mt-1.5 text-[11.5px] text-pb-subtle">
          The script walks descendants recursively, so picking only top-level types still reaches deep ones via their parents.
        </p>
      </div>

      {/* Field */}
      <div className="mb-5">
        <label className={sectionHeadCls}>Field to copy</label>
        {fieldsError ? (
          <>
            <input type="text" value={fieldName} onChange={(e) => setFieldName(e.target.value)} placeholder="e.g. Status" className={inputCls} />
            <p className="mt-1.5 text-[11.5px] text-pb-amber-text">
              Couldn't load field list ({fieldsError}). Type the name manually.
            </p>
          </>
        ) : fields === null ? (
          <div className="rounded-lg border border-pb-dark/[0.08] bg-pb-cream px-3 py-2.5 text-[12.5px] text-pb-subtle">
            Loading fields…
          </div>
        ) : fields.length === 0 ? (
          <p className="text-[12.5px] text-pb-subtle">
            No common fields found across the selected types. Pick at least one child type whose schema overlaps with the parent.
          </p>
        ) : (
          <>
            <div className="relative">
              <select
                value={fieldName}
                onChange={(e) => setFieldName(e.target.value)}
                className={`${inputCls} appearance-none pr-9`}
              >
                <option value="" disabled hidden>Choose a field…</option>
                {groupFields(fields).map(({ type, fields: group }) => (
                  <optgroup key={type} label={type}>
                    {group.map((f) => (
                      <option key={f.key} value={f.name}>{f.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-pb-subtle" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
            </div>
            {(() => {
              const selected = fields.find((f) => f.name === fieldName);
              if (selected?.missingFrom?.length) {
                const missing = selected.missingFrom.map((t) => labelOf(t)).join(', ');
                return (
                  <div className="mt-2 rounded-lg border border-pb-amber/30 bg-pb-err-bg px-3 py-2.5">
                    <p className="text-[12px] text-pb-err-text">
                      This field isn't configured on <span className="font-medium">{missing}</span>, so those entities will be skipped. Add this field under Data → Custom fields in Productboard, then{' '}
                      <button
                        type="button"
                        onClick={() => setFieldsRefreshKey((k) => k + 1)}
                        className="font-medium underline hover:text-pb-dark"
                      >
                        refresh
                      </button>
                      {' '}to confirm.
                    </p>
                  </div>
                );
              }
              return null;
            })()}
          </>
        )}
      </div>

      {/* Schedule */}
      <div className="mb-5">
        <label className={sectionHeadCls}>Schedule</label>
        <SchedulePicker value={schedule} onChange={setSchedule} />
      </div>

      {/* Options */}
      <div className="mb-7">
        <label className={sectionHeadCls}>Behaviour</label>
        <div className="rounded-lg border border-pb-dark/[0.14] bg-white p-1">
          {[
            { key: 'dryRun', value: dryRun, set: setDryRun, label: 'Dry run (preview only)', desc: 'Logs what would change without writing to Productboard. Recommended for first run.' },
            { key: 'overwrite', value: overwriteExisting, set: setOverwriteExisting, label: 'Overwrite existing values on children', desc: 'If off, children that already have a value are left alone.' },
            { key: 'skipEmpty', value: skipIfEmpty, set: setSkipIfEmpty, label: "Skip when parent's field is empty", desc: 'Avoids clearing children when the parent has nothing to give.' },
          ].map(({ key, value, set, label, desc }) => (
            <label
              key={key}
              className="flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-pb-cream/70"
            >
              <span className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] ${
                value ? 'bg-pb-dark text-pb-cream' : 'border-[1.5px] border-pb-dark/[0.22]'
              }`}>
                {value && (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
                )}
              </span>
              <div className="flex-1">
                <div className="text-[13.5px] text-pb-dark">{label}</div>
                <div className="mt-0.5 text-[11.5px] text-pb-subtle">{desc}</div>
              </div>
              <input type="checkbox" checked={value} onChange={(e) => set(e.target.checked)} className="sr-only" />
            </label>
          ))}
        </div>
      </div>

      <button
        disabled={!canContinue}
        onClick={() =>
          onContinue({
            config: { name, parentType, childTypes, fieldName, schedule, dryRun, overwriteExisting, skipIfEmpty },
          })
        }
        className="w-full rounded-lg bg-pb-dark px-4 py-2.5 text-sm font-medium text-pb-cream transition-colors hover:bg-pb-dark/90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitLabel}
      </button>
    </div>
  );
}
