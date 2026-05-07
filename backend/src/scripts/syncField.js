/**
 * Sync a field value from each parent entity down to its descendants.
 *
 * Generalized in V2 — works for any (parentType, childTypes) pair valid in PB's
 * hierarchy. The script walks each parent's full descendant tree, stopping at
 * any descendant that's also of the parent type (so cousins don't fight over
 * the same descendant's value).
 *
 * Config shape:
 *   {
 *     parentType: string,           // e.g. 'product'
 *     childTypes: string[],         // e.g. ['component', 'feature', 'subfeature']
 *     fieldName: string,            // e.g. 'Status'  (the human name from /pb/fields)
 *     dryRun: boolean,
 *     overwriteExisting: boolean,
 *     skipIfEmpty: boolean,
 *     schedule: string,
 *   }
 */
export async function runSyncField(pbClient, config, _workspaceId) {
  const logs = [];
  const log = (msg) => logs.push(msg);

  const parentType = config.parentType || 'feature';
  const childTypes = (config.childTypes || []).filter(Boolean);
  const fieldName = config.fieldName || 'Status';
  const dryRun = !!config.dryRun;
  const overwriteExisting = !!config.overwriteExisting;
  const skipIfEmpty = config.skipIfEmpty !== false;

  if (!childTypes.length) {
    log('Error: no child types selected.');
    return { logs, summary: 'No child types selected' };
  }

  log(`Starting syncField — ${parentType} → [${childTypes.join(', ')}]`);
  log(`Field: "${fieldName}"  ·  ${dryRun ? 'DRY RUN (no writes)' : 'LIVE'}`);
  log(`Options: overwriteExisting=${overwriteExisting}, skipIfEmpty=${skipIfEmpty}`);

  // 1. Resolve the human field name → field key (UUID for custom, slug for built-in)
  //    by reading the parent type's configuration.
  let parentConfig;
  try {
    parentConfig = await pbClient.getEntityConfiguration(parentType);
  } catch (err) {
    log(`[ERROR] Could not load configuration for ${parentType}: ${err.message}`);
    throw err;
  }
  const fieldsByName = Object.entries(parentConfig?.data?.fields || {})
    .map(([key, def]) => ({ key, name: def.name || key }));
  const matched = fieldsByName.find((f) => f.name === fieldName);
  if (!matched) {
    log(`[ERROR] Field "${fieldName}" not found on ${parentType}.`);
    return { logs, summary: `Field "${fieldName}" not found` };
  }
  const fieldKey = matched.key;
  log(`Resolved field "${fieldName}" → key ${fieldKey}`);

  // 2. Fetch all entities involved (parent + every child type).
  //    We need them all in memory to build the tree.
  const allTypes = Array.from(new Set([parentType, ...childTypes]));
  const all = await pbClient.listAllEntities(allTypes);
  log(`Fetched ${all.length} entit${all.length === 1 ? 'y' : 'ies'} across ${allTypes.join(', ')}.`);

  if (!all.length) {
    return { logs, summary: 'No entities found' };
  }

  // 3. Diagnostic dump: first entity's shape, truncated. Helps verify the
  //    fields/relationships layout is what we expect.
  const sample = JSON.stringify(all[0]).slice(0, 400);
  log(`[diag] first entity shape: ${sample}${sample.length >= 400 ? '…' : ''}`);

  // 4. Build maps. Parent relationship is in entity.relationships array.
  const byId = new Map(all.map((e) => [e.id, e]));
  const parentIdOf = (e) => {
    const rels = Array.isArray(e.relationships) ? e.relationships : [];
    const parentRel = rels.find((r) => r.type === 'parent');
    return parentRel?.target?.id || null;
  };
  const childrenOf = new Map(); // parentId → child entities
  for (const e of all) {
    const pid = parentIdOf(e);
    if (!pid) continue;
    const list = childrenOf.get(pid) || [];
    list.push(e);
    childrenOf.set(pid, list);
  }

  const parents = all.filter((e) => e.type === parentType);
  log(`Found ${parents.length} ${parentType}(s).`);

  const childTypeSet = new Set(childTypes);
  let plannedUpdates = 0;
  let appliedUpdates = 0;
  let skipped = 0;
  let parentsSkippedEmpty = 0;

  // 5. Walk each parent's descendant tree, stop expanding at any descendant
  //    that's itself of parentType (so nested parents own their own subtrees).
  for (const parent of parents) {
    const sourceValue = parent.fields?.[fieldKey];
    const parentName = parent.fields?.name || parent.id;

    if (skipIfEmpty && (sourceValue === null || sourceValue === '' || sourceValue === undefined)) {
      log(`[SKIP] ${parentType} "${parentName}": "${fieldName}" is empty`);
      parentsSkippedEmpty++;
      continue;
    }

    // BFS, stop expanding nested parent-type entities.
    const queue = [...(childrenOf.get(parent.id) || [])];
    const seen = new Set();
    while (queue.length) {
      const node = queue.shift();
      if (!node || seen.has(node.id)) continue;
      seen.add(node.id);

      const nodeIsParentType = node.type === parentType;
      const nodeMatchesChildType = childTypeSet.has(node.type);

      if (nodeMatchesChildType) {
        // Apply (or plan) the update.
        const existing = node.fields?.[fieldKey];
        const nodeName = node.fields?.name || node.id;

        if (deepEqual(existing, sourceValue)) {
          skipped++;
        } else {
          const hasValue = existing !== null && existing !== '' && existing !== undefined;
          if (hasValue && !overwriteExisting) {
            log(`[SKIP] ${node.type} "${nodeName}": existing value preserved`);
            skipped++;
          } else if (dryRun) {
            log(`[DRY-RUN] ${node.type} "${nodeName}": would set "${fieldName}" ${fmt(existing)} → ${fmt(sourceValue)}`);
            plannedUpdates++;
          } else {
            try {
              await pbClient.updateEntityFields(node.id, { [fieldKey]: sourceValue });
              log(`[SYNC] ${node.type} "${nodeName}": ${fieldName} ${fmt(existing)} → ${fmt(sourceValue)}`);
              appliedUpdates++;
            } catch (err) {
              const detail = err.response?.data ? JSON.stringify(err.response.data).slice(0, 160) : err.message;
              log(`[ERROR] ${node.type} "${nodeName}": update failed — ${detail}`);
              skipped++;
            }
          }
        }
      }

      // Stop expanding if this node is itself a parent-type entity — its subtree
      // belongs to it, not to the outer parent.
      if (nodeIsParentType) continue;
      const grandchildren = childrenOf.get(node.id) || [];
      queue.push(...grandchildren);
    }
  }

  const tail = parentsSkippedEmpty > 0
    ? ` · ${parentsSkippedEmpty}/${parents.length} ${parentType}(s) had no value to propagate`
    : '';

  if (dryRun) {
    log(`Dry-run complete: would update ${plannedUpdates}, skip ${skipped}${tail ? ',' + tail : ''}.`);
    const summaryTail = parentsSkippedEmpty === parents.length && parents.length > 0
      ? ` (no ${parentType}s had a value)`
      : '';
    return { logs, summary: `Would update ${plannedUpdates} entities (dry run)${summaryTail}` };
  }

  log(`Completed: ${appliedUpdates} updated, ${skipped} descendant(s) skipped${tail}.`);
  const summaryTail = parentsSkippedEmpty === parents.length && parents.length > 0
    ? ` (no ${parentType}s had a value)`
    : '';
  return { logs, summary: `${appliedUpdates} entities synced${summaryTail}` };
}

/** Format a value for human-readable logs. Truncates long strings. */
function fmt(v) {
  if (v === null || v === undefined) return '∅';
  if (typeof v === 'string') return `"${v.length > 40 ? v.slice(0, 40) + '…' : v}"`;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  // For objects (e.g. status, owner) just show id and/or name.
  if (typeof v === 'object') {
    if (Array.isArray(v)) return `[${v.length} item${v.length === 1 ? '' : 's'}]`;
    const id = v.id ? v.id.slice(0, 8) : null;
    const name = v.name || null;
    if (name && id) return `{${name} · ${id}}`;
    if (name) return `{${name}}`;
    if (id) return `{${id}}`;
    return JSON.stringify(v).slice(0, 60);
  }
  return String(v);
}

/** Shallow-ish deep equality good enough for PB field values. */
function deepEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;
  // For object fields like status/owner, compare by id.
  if (a.id && b.id) return a.id === b.id;
  // For arrays of refs (tags, teams), compare sets of ids.
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    const aIds = new Set(a.map((x) => x?.id).filter(Boolean));
    const bIds = new Set(b.map((x) => x?.id).filter(Boolean));
    if (aIds.size !== bIds.size) return false;
    for (const id of aIds) if (!bIds.has(id)) return false;
    return true;
  }
  // Fallback: JSON compare.
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}
