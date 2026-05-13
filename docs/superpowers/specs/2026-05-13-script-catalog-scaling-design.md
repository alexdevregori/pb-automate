# PB Automate — Script Catalog Scaling Design

**Date:** 2026-05-13
**Status:** Approved — pending implementation plan

## Problem

The app currently has one working script (`syncField`) and two stubs (`propagateTags`, `rollupScore`). Adding script #2 requires editing three hardcoded dispatch points:

1. `backend/src/routes/scripts.js` — `executeScript()` only routes `syncField`, everything else throws
2. `frontend/src/pages/Configure.jsx` — ignores `scriptId`, always renders `SyncFieldConfigure`
3. `frontend/src/pages/ScriptNew.jsx` — `SCRIPTS` array is manually maintained

Additionally, each new Claude session starts with zero knowledge of PB's data model, entity relationships, and API quirks — leading to bugs or wrong assumptions when building new scripts.

## Goals

1. Make adding a new script to the catalog a one-file-per-concern operation with no changes to shared plumbing
2. Give Claude persistent PB domain knowledge available in every future session
3. Create a `/pb-script` skill that uses that knowledge to scaffold new scripts correctly

## Non-goals

- Customer-facing script builder (customers pick from catalog, they don't build scripts)
- Dynamic/AI-generated scripts at runtime
- Changes to the deploy flow, run persistence, Firestore schema, or API route structure

## Solution overview

Three pieces, each with a single responsibility:

| Piece | Purpose |
|---|---|
| `docs/pb-domain.md` | Living PB knowledge base — entity hierarchy, field types, API quirks |
| Script registry (backend + frontend) | Maps `scriptId` → runner / ConfigureComponent — one line per script |
| `/pb-script` Claude skill | Reads domain doc, asks discovery questions, scaffolds new scripts |

## 1. `docs/pb-domain.md`

A markdown reference file committed to the repo. Contains four sections:

**Entity hierarchy** — full type tree with nesting rules. Which types can be parents of which, which types are leaf nodes (e.g. sub-features have no children), which hierarchies are separate (initiatives/objectives/key results/releases are independent of the product→component→feature tree). Includes the non-obvious rules like: components can be nested under other components (recursive).

**Field types** — what each field type means in practice and what the PB PATCH API accepts per type. Key gotchas already discovered: single-select uses `{name}` not `{id}` on write, member fields use `{email}`, tag arrays use `[{id}]`, the `addItems`/`removeItems` operations vs full `set`.

**API patterns** — discovered quirks not obvious from the spec: inline relationships only include page 1 (must fallback-fetch for entities without an inline parent), `getEntityConfiguration` is the right way to discover fields, pagination via `pageCursor`, how to strip the base URL from `links.next`.

**Script catalog notes** — one paragraph per script: what it does, which PB surfaces it touches, known constraints, edge cases. Grows with each script added.

**Feedback loop:** when building a new script surfaces a new PB quirk, it gets written back into `docs/pb-domain.md` before the session ends. The doc gets richer with every script.

## 2. Script registry refactor

### Backend

New file: `backend/src/scripts/index.js`

```js
import { runSyncField } from './syncField.js';
import { runPropagateTags } from './propagateTags.js';

export const SCRIPT_REGISTRY = {
  syncField:     { runner: runSyncField,     name: 'Sync Custom Field',  description: '...' },
  propagateTags: { runner: runPropagateTags, name: 'Propagate Tags',     description: '...' },
};
```

`executeScript()` in `scripts.js` becomes a generic registry lookup — never needs to change again when a new script is added.

The hardcoded `AVAILABLE_SCRIPTS` array in `scripts.js` (used by `GET /scripts` to return the catalog) is also replaced by a registry-derived list — `Object.entries(SCRIPT_REGISTRY).map(([id, s]) => ({ id, name: s.name, description: s.description }))`.

### Frontend

New file: `frontend/src/lib/scriptRegistry.js`

```js
import SyncFieldConfigure from '../pages/configure/SyncFieldConfigure.jsx';
import PropagateTagsConfigure from '../pages/configure/PropagateTagsConfigure.jsx';

export const SCRIPT_REGISTRY = {
  syncField:     { label: 'Sync Custom Field',  description: '...', ConfigureComponent: SyncFieldConfigure },
  propagateTags: { label: 'Propagate Tags',      description: '...', ConfigureComponent: PropagateTagsConfigure },
};
```

`Configure.jsx` does a registry lookup on `scriptId` instead of hardcoding `SyncFieldConfigure`.

`ScriptNew.jsx` derives the script picker list from the registry instead of a manual `SCRIPTS` array.

The existing `SyncFieldConfigure` logic moves to `frontend/src/pages/configure/SyncFieldConfigure.jsx` — no logic changes, just a file move.

### Adding script N

1. Create `backend/src/scripts/myScript.js` — export `runMyScript(pbClient, config, workspaceId)`
2. Create `frontend/src/pages/configure/MyScriptConfigure.jsx` — export default config form component
3. Add one entry to each registry

Nothing else changes.

## 3. `/pb-script` Claude skill

A Claude Code skill invoked with `/pb-script` when adding a new script to the catalog.

**On invocation:**
1. Reads `docs/pb-domain.md` for full PB context
2. Reads `backend/src/scripts/index.js` and `frontend/src/lib/scriptRegistry.js` to understand current state
3. Reads `backend/src/scripts/syncField.js` and its Configure component as reference implementations

**Discovery questions** (fills in answers from domain doc where known, only asks about genuine gaps):
- What should this script do? (plain English)
- Which entity types are involved?
- What inputs does the user need to provide on the configure form?
- Any known edge cases or PB constraints for this operation?
- Does this script need a dry run mode?

**Output:**
- `backend/src/scripts/<scriptId>.js` — runner following syncField's pattern
- `frontend/src/pages/configure/<ScriptId>Configure.jsx` — configure component
- Registry entries added to both registries
- Any new PB knowledge discovered written back to `docs/pb-domain.md`

## File changes summary

| File | Change |
|---|---|
| `docs/pb-domain.md` | New — PB knowledge base |
| `backend/src/scripts/index.js` | New — backend registry |
| `frontend/src/lib/scriptRegistry.js` | New — frontend registry |
| `backend/src/routes/scripts.js` | Edit — use registry in `executeScript()` |
| `frontend/src/pages/Configure.jsx` | Edit — dispatch via registry |
| `frontend/src/pages/ScriptNew.jsx` | Edit — derive script list from registry |
| `frontend/src/pages/configure/SyncFieldConfigure.jsx` | New — move existing logic here |
| Claude plugin skill `pb-script` | New — scaffold skill |
