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
