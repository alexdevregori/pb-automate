import { saveRunLog } from '../services/firestore.js';

/**
 * Sync a custom field value between parent and child features.
 *
 * Config shape:
 *   { sourceEntity, targetEntity, sourceField, targetField,
 *     direction, overwriteExisting, skipIfEmpty, logChanges }
 */
export async function runSyncField(pbClient, config, workspaceId) {
  const logs = [];
  const log = (msg) => logs.push(msg);

  log(`Starting syncField — direction: ${config.direction}`);
  log(`Source: ${config.sourceEntity}.${config.sourceField} → Target: ${config.targetEntity}.${config.targetField}`);

  // Fetch all features (paginate if needed)
  let allFeatures = [];
  let cursor = null;
  do {
    const res = await pbClient.getFeatures(cursor);
    allFeatures = allFeatures.concat(res.data);
    cursor = res.pageCursor || null;
  } while (cursor);

  log(`Fetched ${allFeatures.length} features`);

  // Build parent-child map
  const featureMap = new Map(allFeatures.map((f) => [f.id, f]));
  const parentToChildren = new Map();
  for (const f of allFeatures) {
    if (f.parent) {
      const children = parentToChildren.get(f.parent) || [];
      children.push(f.id);
      parentToChildren.set(f.parent, children);
    }
  }

  let synced = 0;
  let skipped = 0;

  for (const feature of allFeatures) {
    const children = parentToChildren.get(feature.id) || [];
    if (children.length === 0 && config.direction !== 'children-to-parent') continue;
    if (feature.parent && config.direction === 'children-to-parent') continue;

    // Get custom fields for the source feature
    const sourceFields = await pbClient.getFeatureCustomFields(feature.id);
    const sourceField = sourceFields.data?.find(
      (f) => f.name === config.sourceField || f.id === config.sourceField
    );

    if (!sourceField) {
      log(`[SKIP] ${feature.name} (${feature.id}): source field "${config.sourceField}" not found`);
      skipped++;
      continue;
    }

    if (config.skipIfEmpty && (sourceField.value === null || sourceField.value === '')) {
      log(`[SKIP] ${feature.name} (${feature.id}): source field is empty`);
      skipped++;
      continue;
    }

    // Determine targets based on direction
    let targetIds = [];
    if (config.direction === 'parent-to-children') {
      targetIds = children;
    } else if (config.direction === 'children-to-parent' && feature.parent) {
      targetIds = [feature.parent];
    } else if (config.direction === 'bidirectional') {
      targetIds = [...children];
      if (feature.parent) targetIds.push(feature.parent);
    }

    for (const targetId of targetIds) {
      const targetFields = await pbClient.getFeatureCustomFields(targetId);
      const targetField = targetFields.data?.find(
        (f) => f.name === config.targetField || f.id === config.targetField
      );

      if (!targetField) {
        log(`[SKIP] Target ${targetId}: field "${config.targetField}" not found`);
        skipped++;
        continue;
      }

      if (!config.overwriteExisting && targetField.value !== null && targetField.value !== '') {
        log(`[SKIP] Target ${targetId}: existing value "${targetField.value}" preserved`);
        skipped++;
        continue;
      }

      if (targetField.value === sourceField.value) {
        skipped++;
        continue;
      }

      const oldValue = targetField.value;
      await pbClient.updateCustomField(targetId, targetField.id, sourceField.value);

      const targetFeature = featureMap.get(targetId);
      const changeLog = `[SYNC] ${targetFeature?.name || targetId}: ${config.targetField} "${oldValue}" → "${sourceField.value}"`;
      log(changeLog);

      if (config.logChanges) {
        await saveRunLog(workspaceId, 'syncField', {
          featureId: targetId,
          field: config.targetField,
          oldValue,
          newValue: sourceField.value,
        });
      }

      synced++;
    }
  }

  log(`Completed: ${synced} synced, ${skipped} skipped`);
  return logs;
}
