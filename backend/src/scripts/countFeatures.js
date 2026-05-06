/**
 * Smoke-test script: count features in the workspace.
 *
 * Read-only. Calls PB once (paginating if needed), tallies totals by type,
 * and returns log lines. Useful for verifying the deploy pipeline end-to-end
 * without mutating any data.
 */
export async function runCountFeatures(pbClient, _config, workspaceId) {
  const logs = [];
  const log = (msg) => {
    const line = `[countFeatures:${workspaceId}] ${msg}`;
    console.log(line);   // visible in local terminal + Cloud Run logs
    logs.push(msg);      // returned to the UI / Firestore
  };

  log('Starting countFeatures…');

  let all = [];
  let cursor = null;
  let pages = 0;
  try {
    do {
      const res = await pbClient.getFeatures(cursor);
      all = all.concat(res.data || []);
      cursor = res.pageCursor || null;
      pages += 1;
      if (pages > 50) {
        log('Stopping after 50 pages (safety limit).');
        break;
      }
    } while (cursor);
  } catch (err) {
    log(`PB API call failed: ${err.message}`);
    throw err;
  }

  log(`Fetched ${all.length} feature(s) across ${pages} page(s).`);

  const byType = {};
  for (const f of all) {
    const t = f.type || 'unknown';
    byType[t] = (byType[t] || 0) + 1;
  }
  for (const [type, count] of Object.entries(byType)) {
    log(`  ${type}: ${count}`);
  }

  const sample = all.slice(0, 5).map((f) => f.name).filter(Boolean);
  if (sample.length) {
    log(`Sample: ${sample.join(', ')}`);
  }

  log('countFeatures complete ✓');
  return logs;
}
