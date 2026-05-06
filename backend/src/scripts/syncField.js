/**
 * Sync a custom field value from each parent feature down to its children.
 *
 * Same-name field on both ends — the user picks one field name, and the script
 * copies its value from every parent that has children to those children.
 *
 * Config shape:
 *   {
 *     fieldName: string,            // e.g. "Status"
 *     dryRun: boolean,              // if true, log what would change but don't write
 *     overwriteExisting: boolean,   // if false, skip children that already have a value
 *     skipIfEmpty: boolean,         // if true, don't propagate when the parent's value is blank
 *     schedule: string,             // 'manual' | 'hourly' | 'daily' | 'on-change'
 *   }
 */
export async function runSyncField(pbClient, config, _workspaceId) {
  const logs = [];
  const log = (msg) => logs.push(msg);

  const fieldName = config.fieldName || 'Status';
  const dryRun = !!config.dryRun;
  const overwriteExisting = !!config.overwriteExisting;
  const skipIfEmpty = config.skipIfEmpty !== false; // default true

  log(`Starting syncField — direction: parent → children`);
  log(`Field: "${fieldName}"  ·  ${dryRun ? 'DRY RUN (no writes)' : 'LIVE'}`);
  log(`Options: overwriteExisting=${overwriteExisting}, skipIfEmpty=${skipIfEmpty}`);

  // 1. Fetch every feature in the workspace.
  let allFeatures = [];
  let cursor = null;
  let pages = 0;
  do {
    const res = await pbClient.getFeatures(cursor);
    allFeatures = allFeatures.concat(res.data || []);
    cursor = res.pageCursor || null;
    pages += 1;
    if (pages > 50) {
      log(`Stopping after 50 pages (safety limit).`);
      break;
    }
  } while (cursor);

  log(`Fetched ${allFeatures.length} features across ${pages} page(s).`);

  // 2. Build a parent → [children] map. PB's feature shape can have either
  //    `parent: 'feat-1'` or `parent: { id: 'feat-1' }` depending on the API
  //    revision, so handle both.
  const parentIdOf = (f) => (typeof f.parent === 'string' ? f.parent : f.parent?.id) || null;
  const parentToChildren = new Map();
  for (const f of allFeatures) {
    const pid = parentIdOf(f);
    if (!pid) continue;
    const children = parentToChildren.get(pid) || [];
    children.push(f);
    parentToChildren.set(pid, children);
  }

  const parents = allFeatures.filter((f) => parentToChildren.has(f.id));
  log(`Found ${parents.length} parent feature(s) with at least one child.`);

  // 3. Walk each parent. Diagnostic dump on the first parent so we can verify
  //    the custom-fields response shape against what this code assumes.
  let plannedUpdates = 0;
  let appliedUpdates = 0;
  let skipped = 0;
  let firstShapeLogged = false;

  for (const parent of parents) {
    const children = parentToChildren.get(parent.id) || [];

    let parentFieldsRes;
    try {
      parentFieldsRes = await pbClient.getFeatureCustomFields(parent.id);
    } catch (err) {
      log(`[ERROR] Could not fetch custom fields for parent ${parent.id}: ${err.message}`);
      skipped += children.length;
      continue;
    }

    if (!firstShapeLogged) {
      // One-time diagnostic — first custom-fields response shape, truncated.
      const sample = JSON.stringify(parentFieldsRes).slice(0, 240);
      log(`[diag] first custom-fields response: ${sample}${sample.length >= 240 ? '…' : ''}`);
      firstShapeLogged = true;
    }

    const parentField = (parentFieldsRes.data || []).find((f) => f.name === fieldName);
    if (!parentField) {
      log(`[SKIP] ${parent.name || parent.id}: field "${fieldName}" not found on parent`);
      skipped += children.length;
      continue;
    }

    const sourceValue = parentField.value;
    if (skipIfEmpty && (sourceValue === null || sourceValue === '' || sourceValue === undefined)) {
      log(`[SKIP] ${parent.name || parent.id}: parent's "${fieldName}" is empty`);
      skipped += children.length;
      continue;
    }

    for (const child of children) {
      let childFieldsRes;
      try {
        childFieldsRes = await pbClient.getFeatureCustomFields(child.id);
      } catch (err) {
        log(`[ERROR] Could not fetch custom fields for child ${child.id}: ${err.message}`);
        skipped++;
        continue;
      }

      const childField = (childFieldsRes.data || []).find((f) => f.name === fieldName);
      if (!childField) {
        log(`[SKIP] ${child.name || child.id}: field "${fieldName}" not found on child`);
        skipped++;
        continue;
      }

      if (childField.value === sourceValue) {
        skipped++;
        continue;
      }

      const childHasValue = childField.value !== null && childField.value !== '' && childField.value !== undefined;
      if (childHasValue && !overwriteExisting) {
        log(`[SKIP] ${child.name || child.id}: existing value "${childField.value}" preserved`);
        skipped++;
        continue;
      }

      if (dryRun) {
        log(`[DRY-RUN] ${child.name || child.id}: would set "${fieldName}" "${childField.value ?? ''}" → "${sourceValue}"`);
        plannedUpdates++;
        continue;
      }

      try {
        await pbClient.updateCustomField(child.id, childField.id, sourceValue);
        log(`[SYNC] ${child.name || child.id}: ${fieldName} "${childField.value ?? ''}" → "${sourceValue}"`);
        appliedUpdates++;
      } catch (err) {
        log(`[ERROR] ${child.name || child.id}: update failed — ${err.message}`);
        skipped++;
      }
    }
  }

  if (dryRun) {
    log(`Dry-run complete: would update ${plannedUpdates}, skip ${skipped}.`);
    return { logs, summary: `Would update ${plannedUpdates} features (dry run)` };
  }

  log(`Completed: ${appliedUpdates} updated, ${skipped} skipped.`);
  return { logs, summary: `${appliedUpdates} features synced` };
}
