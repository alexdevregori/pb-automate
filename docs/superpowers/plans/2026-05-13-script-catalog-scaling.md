# Script Catalog Scaling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make adding new scripts to the catalog a one-file-per-concern operation, and give Claude persistent PB domain knowledge via a `docs/pb-domain.md` reference and a `/pb-script` scaffold skill.

**Architecture:** A backend and frontend script registry each map `scriptId` → runner/ConfigureComponent. The shared plumbing (API routes, deploy flow, Firestore schema) never needs to change when a new script is added. A `docs/pb-domain.md` file encodes PB's entity hierarchy, field types, and API quirks so future Claude sessions build correct scripts without needing re-explanation.

**Tech Stack:** Node.js/Express (backend), React/Vite (frontend), Vitest (tests), Claude Code skills (pb-script scaffold)

---

## File Map

| File | Change |
|---|---|
| `docs/pb-domain.md` | **Create** — PB knowledge base |
| `backend/src/scripts/index.js` | **Create** — backend script registry |
| `backend/src/routes/scripts.js` | **Modify** — use registry in `executeScript()` and `AVAILABLE_SCRIPTS` |
| `backend/src/scripts/index.test.js` | **Create** — registry unit test |
| `frontend/src/lib/scriptRegistry.js` | **Create** — frontend script registry |
| `frontend/src/pages/configure/SyncFieldConfigure.jsx` | **Create** — move SyncFieldConfigure logic here from Configure.jsx |
| `frontend/src/pages/Configure.jsx` | **Modify** — dispatch to registry instead of hardcoding SyncFieldConfigure |
| `frontend/src/pages/ScriptNew.jsx` | **Modify** — derive SCRIPTS list from registry |
| `frontend/src/pages/Deploy.jsx` | **Modify** — show script label from registry instead of hardcoded "Sync Field" |
| Claude skill `pb-script` | **Create** — scaffold skill via writing-skills |

---

## Task 1: Write `docs/pb-domain.md`

**Files:**
- Create: `docs/pb-domain.md`

This file is the living PB knowledge base. Claude reads it at the start of any script-building session. Write it once, update it whenever a new quirk is discovered.

- [ ] **Step 1: Create the file**

Create `docs/pb-domain.md` with the content below. This encodes everything currently known about PB's data model from the existing codebase (`pb.js`, `syncField.js`, `pbClient.js`).

```markdown
# Productboard Domain Reference

This file is the source of truth for PB's data model, API patterns, and field semantics as observed in production. Update it whenever a script uncovers a new quirk.

---

## Entity Types

Productboard V2 unifies all entity types under a single `/v2/entities` endpoint. The types are:

| Type | Description |
|---|---|
| `product` | Top-level product container |
| `component` | Grouping layer beneath products. Can nest recursively (component → component). |
| `feature` | Work item beneath a component |
| `subfeature` | Child of a feature. **Leaf node — no children.** |
| `initiative` | Strategic initiative, lives in the objectives hierarchy |
| `objective` | OKR-style objective |
| `keyResult` | Key result beneath an objective |
| `release` | Release/milestone container |
| `releaseGroup` | Groups multiple releases |
| `user` | Workspace member (read-only in most contexts) |
| `company` | Company/account (CRM feature) |

---

## Entity Hierarchy

The valid parent → child relationships. A child entity's parent is determined by the `parent` relationship in `entity.relationships.data`.

```
product   → component, feature, subfeature
component → component, feature, subfeature   ← components CAN nest under other components
feature   → subfeature
release   → initiative, feature, subfeature
objective → keyResult, objective, initiative, feature, subfeature
```

**Key rules:**
- `component` is recursive — a component can be the parent of another component, which can be the parent of another component, arbitrarily deep.
- `subfeature` is a leaf node — it has no valid children.
- `initiative`, `objective`, `keyResult` live in a separate hierarchy from the product→component→feature tree. They can coexist under releases/objectives but are not part of the standard product hierarchy.
- `listAllEntities(['product','component','feature','subfeature'])` fetches all four types in one paginated call. You still need to build the tree yourself using parent relationships.
- A customer's actual workspace may only use a subset of these types. Always derive the hierarchy dynamically from `GET /pb/hierarchy` in the UI rather than hardcoding assumptions about what a workspace contains.

---

## Field Keys

Custom fields use **UUID v4 keys** (e.g. `a1b2c3d4-...`). Built-in fields use **slug keys** (e.g. `status`, `owner`, `name`, `description`).

Use `GET /v2/entities/configurations/{type}` → `data.fields` to discover field keys for a given entity type. This returns a map of `fieldKey → { name, schema }`.

The `/pb/fields` route in this app intersects fields across multiple entity types — it only returns fields that exist on all requested types.

---

## Field Types and PATCH Format

The PB V2 PATCH API is strict about what it accepts per field type. Wrong format → 422 error.

| Field type (detected by) | PATCH value format |
|---|---|
| Option / single-select (has `color` attr on read) | `{ name: "Option Name" }` — **never `{id}`** |
| Member / user | `{ email: "user@example.com" }` |
| Entity reference (has `id` attr) | `{ id: "uuid" }` |
| Tags / multi-select (array of objects with `id`) | `[{ id: "uuid" }, ...]` |
| Text / rich text | `"string value"` |
| Number | `42` |
| Date | `"YYYY-MM-DD"` |
| Boolean | `true` / `false` |

**The `patchValue()` function in `backend/src/scripts/syncField.js` implements this logic.** Copy it into any new script that needs to PATCH field values.

---

## API Patterns

### Pagination
All list endpoints paginate via `pageCursor`. Pattern:

```js
let cursor = null;
do {
  if (cursor) params.set('pageCursor', cursor);
  const res = await client.get(`/entities?${params}`);
  all = all.concat(res.data?.data || []);
  const next = res.data?.links?.next;
  cursor = next
    ? decodeURIComponent(/[?&]pageCursor=([^&]+)/.exec(next)?.[1] ?? '')
    : res.data?.pageCursor ?? null;
} while (cursor);
```

`links.next` is an **absolute URL** — strip the base (`https://api.productboard.com/v2`) before passing to the axios client.

### Inline Relationships (page 1 only)
The V2 list endpoint includes `entity.relationships.data` inline, but only the **first page**. Entities with many relationships (e.g. a component with dozens of features) may have their parent relationship on page 2+.

**Always** run a fallback pass for entities that don't have an inline parent relationship:

```js
async fetchParentId(entityId) {
  // Implemented in pbClient.js — fetches /entities/{id}/relationships and
  // walks pages until it finds type === 'parent'.
}
```

### Finding the Parent Relationship
In `relationships.data`, the parent is the entry with `type === 'parent'`:

```js
const parentRel = relationships.find(r => r.type === 'parent');
const parentId = parentRel?.target?.id;
```

### Entity Configuration
```js
pbClient.getEntityConfiguration('feature')
// → { data: { fields: { 'uuid-key': { name: 'My Field', schema: { type: 'string' } } } } }
```

---

## Script Catalog

### syncField
**What it does:** Copies a custom field value from each parent entity down to all matching child/descendant entities. Walks the full descendant tree recursively, stopping at nested entities of the parent type.

**Config:** `parentType`, `childTypes[]`, `fieldName`, `dryRun`, `overwriteExisting`, `skipIfEmpty`

**PB surfaces:** `listAllEntities`, `getEntityConfiguration`, `updateEntityFields`, `fetchParentId` (fallback)

**Known constraints:** Uses full-set PATCH (not addItems/removeItems). Reads field value from parent's inline `fields` map — if the parent was fetched via a list endpoint that doesn't return custom fields inline, the value will be missing. Diagnosis: check `[diag]` log lines for `MISSING` on the field key.

---

## Adding a New Script

1. Create `backend/src/scripts/myScript.js` — export `async function runMyScript(pbClient, config, workspaceId) → { logs, summary }`
2. Create `frontend/src/pages/configure/MyScriptConfigure.jsx` — export default React component accepting `{ onContinue, initialConfig, submitLabel }`
3. Add one entry to `backend/src/scripts/index.js` registry
4. Add one entry to `frontend/src/lib/scriptRegistry.js` registry
5. Update this file's Script Catalog section
```

- [ ] **Step 2: Commit**

```bash
git add docs/pb-domain.md
git commit -m "docs: add PB domain reference (entity hierarchy, field types, API patterns)"
```

---

## Task 2: Backend Script Registry

**Files:**
- Create: `backend/src/scripts/index.js`
- Create: `backend/src/scripts/index.test.js`
- Modify: `backend/src/routes/scripts.js`

- [ ] **Step 1: Write the failing test**

Create `backend/src/scripts/index.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { SCRIPT_REGISTRY } from './index.js';

describe('SCRIPT_REGISTRY', () => {
  it('exports an object', () => {
    expect(typeof SCRIPT_REGISTRY).toBe('object');
    expect(SCRIPT_REGISTRY).not.toBeNull();
  });

  it('has a runner function for every registered script', () => {
    for (const [id, entry] of Object.entries(SCRIPT_REGISTRY)) {
      expect(typeof entry.runner, `${id} is missing a runner function`).toBe('function');
    }
  });

  it('has name and description strings for every registered script', () => {
    for (const [id, entry] of Object.entries(SCRIPT_REGISTRY)) {
      expect(typeof entry.name, `${id} is missing name`).toBe('string');
      expect(typeof entry.description, `${id} is missing description`).toBe('string');
    }
  });

  it('includes syncField', () => {
    expect(SCRIPT_REGISTRY).toHaveProperty('syncField');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npx vitest run src/scripts/index.test.js
```

Expected: FAIL — `Cannot find module './index.js'`

- [ ] **Step 3: Create the registry**

Create `backend/src/scripts/index.js`:

```js
import { runSyncField } from './syncField.js';
import { runPropagateTags } from './propagateTags.js';
import { runRollupScore } from './rollupScore.js';

export const SCRIPT_REGISTRY = {
  syncField: {
    runner: runSyncField,
    name: 'Sync Custom Field',
    description: 'Sync a custom field value from parent to child entities.',
  },
  propagateTags: {
    runner: runPropagateTags,
    name: 'Propagate Tags',
    description: 'Copy tags from parent features down to all child sub-features.',
  },
  rollupScore: {
    runner: runRollupScore,
    name: 'Roll Up Priority Score',
    description: 'Aggregate child priority scores to the parent feature level.',
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && npx vitest run src/scripts/index.test.js
```

Expected: PASS (4 tests)

- [ ] **Step 5: Update `backend/src/routes/scripts.js`**

Make three targeted edits:

**Edit 1** — replace the `runSyncField` import with the registry import. Find:
```js
import { runSyncField } from '../scripts/syncField.js';
```
Replace with:
```js
import { SCRIPT_REGISTRY } from '../scripts/index.js';
```

**Edit 2** — replace the hardcoded `AVAILABLE_SCRIPTS` array. Find:
```js
const AVAILABLE_SCRIPTS = [
  {
    id: 'syncField',
    name: 'Sync Custom Field',
    description: 'Sync a custom field value between parent and child features.',
  },
  {
    id: 'rollupScore',
    name: 'Roll Up Priority Score',
    description: 'Aggregate child priority scores to the parent feature level.',
  },
  {
    id: 'propagateTags',
    name: 'Propagate Tags',
    description: 'Copy tags from parent features down to all child sub-features.',
  },
];
```
Replace with:
```js
const AVAILABLE_SCRIPTS = Object.entries(SCRIPT_REGISTRY).map(([id, s]) => ({
  id, name: s.name, description: s.description,
}));
```

**Edit 3** — replace the hardcoded `executeScript` dispatch. Find:
```js
async function executeScript(scriptId, pbClient, config, workspaceId) {
  if (scriptId === 'syncField') return runSyncField(pbClient, config, workspaceId);
  throw new Error(`No runner registered for scriptId="${scriptId}"`);
}
```
Replace with:
```js
async function executeScript(scriptId, pbClient, config, workspaceId) {
  const entry = SCRIPT_REGISTRY[scriptId];
  if (!entry) throw new Error(`No runner registered for scriptId="${scriptId}"`);
  return entry.runner(pbClient, config, workspaceId);
}
```

- [ ] **Step 6: Run full backend test suite**

```bash
cd backend && npx vitest run
```

Expected: all existing tests pass + the 4 new registry tests pass.

- [ ] **Step 7: Commit**

```bash
git add backend/src/scripts/index.js backend/src/scripts/index.test.js backend/src/routes/scripts.js
git commit -m "feat: backend script registry — one entry per script, no more hardcoded dispatch"
```

---

## Task 3: Frontend Registry + SyncFieldConfigure Extraction

**Files:**
- Create: `frontend/src/pages/configure/SyncFieldConfigure.jsx`
- Create: `frontend/src/lib/scriptRegistry.js`
- Modify: `frontend/src/pages/Configure.jsx`
- Modify: `frontend/src/pages/ScriptNew.jsx`
- Modify: `frontend/src/pages/Deploy.jsx`

- [ ] **Step 1: Create `frontend/src/pages/configure/SyncFieldConfigure.jsx`**

This is a straight extraction of the `SyncFieldConfigure` function from `Configure.jsx`. Copy the entire `SyncFieldConfigure` function (and its helpers) out of `Configure.jsx` into a new file, changing only the export.

Create `frontend/src/pages/configure/SyncFieldConfigure.jsx` with this content — everything is lifted verbatim from `Configure.jsx`:

```jsx
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
            No common fields found across the selected types.
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

      <div className="mb-5">
        <label className={sectionHeadCls}>Schedule</label>
        <SchedulePicker value={schedule} onChange={setSchedule} />
      </div>

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
```

- [ ] **Step 2: Create `frontend/src/lib/scriptRegistry.js`**

```js
import SyncFieldConfigure from '../pages/configure/SyncFieldConfigure.jsx';

export const SCRIPT_REGISTRY = {
  syncField: {
    label: 'Sync Custom Field',
    description: 'Sync a custom field value from parent to child entities.',
    ConfigureComponent: SyncFieldConfigure,
  },
};
```

- [ ] **Step 3: Update `frontend/src/pages/Configure.jsx`**

Replace the entire file content with the following. The `SyncFieldConfigure` function and all its helpers are gone — they now live in `SyncFieldConfigure.jsx`. The `Configure` component becomes a one-line dispatcher.

```jsx
import { SCRIPT_REGISTRY } from '../lib/scriptRegistry';

export default function Configure({ scriptId, onContinue, initialConfig, submitLabel }) {
  const entry = SCRIPT_REGISTRY[scriptId];
  if (!entry) {
    return (
      <div className="rounded-lg border border-pb-err-bg bg-pb-err-bg/50 p-4 text-sm text-pb-err-text">
        Unknown script: {scriptId}
      </div>
    );
  }
  const { ConfigureComponent } = entry;
  return <ConfigureComponent onContinue={onContinue} initialConfig={initialConfig} submitLabel={submitLabel} />;
}
```

- [ ] **Step 4: Update `frontend/src/pages/ScriptNew.jsx`**

Replace the hardcoded `SCRIPTS` array with a registry-derived one. Find:

```js
const SCRIPTS = [
  { id: 'syncField', label: 'Sync Custom Field' },
];
```

Replace with:

```js
import { SCRIPT_REGISTRY } from '../lib/scriptRegistry';
// ...
const SCRIPTS = Object.entries(SCRIPT_REGISTRY).map(([id, s]) => ({ id, label: s.label }));
```

Note: move the `import` to the top of the file with the other imports, not inline.

- [ ] **Step 5: Fix hardcoded script name in `frontend/src/pages/Deploy.jsx`**

In `Deploy.jsx`, the review table hardcodes `'Sync Field'` as the Script row value. Fix it to use the registry label.

Add the import at the top of `Deploy.jsx`:
```js
import { SCRIPT_REGISTRY } from '../lib/scriptRegistry';
```

Find this line in the `rows` array:
```js
['Script',             'Sync Field'],
```

Replace with:
```js
['Script', SCRIPT_REGISTRY[scriptId]?.label || scriptId],
```

- [ ] **Step 6: Verify the app still works**

Start the dev server and open the browser:

```bash
npm run dev
```

Navigate to `/scripts/new`. Confirm:
- The configure form still loads for `syncField`
- The "Review & Deploy" page shows "Sync Custom Field" (not "Sync Field") in the Script row
- No console errors

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/configure/SyncFieldConfigure.jsx \
        frontend/src/lib/scriptRegistry.js \
        frontend/src/pages/Configure.jsx \
        frontend/src/pages/ScriptNew.jsx \
        frontend/src/pages/Deploy.jsx
git commit -m "feat: frontend script registry — Configure dispatches via registry, SyncFieldConfigure extracted"
```

---

## Task 4: Write the `/pb-script` Scaffold Skill

**Files:**
- Create: Claude skill `pb-script` (path determined by `writing-skills` skill)

This task uses the `writing-skills` skill to author the scaffold skill. Do not hand-write the skill file directly — invoke the skill so it handles plugin location, frontmatter format, and registration correctly.

- [ ] **Step 1: Invoke the `writing-skills` skill**

Run `/writing-skills` and provide the following spec when prompted.

**Skill name:** `pb-script`

**Purpose:** Scaffolds a new script for pb-automate. Reads `docs/pb-domain.md` for PB context, reads the existing registries and `syncField` as reference implementations, asks discovery questions, then generates the backend runner, frontend Configure component, and registry entries.

**Trigger:** User types `/pb-script` in a pb-automate session.

**Behavior the skill should encode:**

1. Announce: "Using pb-script skill to scaffold a new script."

2. Read these files for context (before asking any questions):
   - `docs/pb-domain.md`
   - `backend/src/scripts/index.js`
   - `frontend/src/lib/scriptRegistry.js`
   - `backend/src/scripts/syncField.js` (reference runner)
   - `frontend/src/pages/configure/SyncFieldConfigure.jsx` (reference configure component)

3. Ask these discovery questions (one at a time):
   - "What should this script do?" (plain English description)
   - "Which entity types are involved?" (parent type, child/target types)
   - "What inputs does the user need to provide on the configure form?"
   - "Are there any known edge cases or PB constraints for this operation?" (fill in from domain doc if known)
   - "Does this script need a dry run mode?"

4. Generate:
   - `backend/src/scripts/<scriptId>.js` — runner following syncField's signature: `export async function run<ScriptId>(pbClient, config, workspaceId) → { logs, summary }`
   - `frontend/src/pages/configure/<ScriptId>Configure.jsx` — configure component accepting `{ onContinue, initialConfig, submitLabel }`
   - Registry entry for `backend/src/scripts/index.js`
   - Registry entry for `frontend/src/lib/scriptRegistry.js`
   - Script Catalog entry in `docs/pb-domain.md`

5. If a new PB API quirk is discovered during scaffolding, write it back to `docs/pb-domain.md` before finishing.

- [ ] **Step 2: Verify skill is registered**

After `writing-skills` finishes, confirm the skill appears in the available skills list by starting a new session or running `/help`.

- [ ] **Step 3: Test the skill**

In a fresh session, type `/pb-script` and walk through scaffolding `propagateTags` as a test case. Confirm it reads `docs/pb-domain.md`, asks the discovery questions, and produces the correct file stubs.
