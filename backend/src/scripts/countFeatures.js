/**
 * Smoke-test script: count entities in the workspace.
 *
 * Read-only. Calls PB once (paginating internally), tallies totals by type,
 * and returns log lines. Useful for verifying the deploy pipeline end-to-end
 * without mutating any data.
 */
export async function runCountFeatures(pbClient, _config, workspaceId) {
  const logs = [];
  const log = (msg) => {
    const line = `[countFeatures:${workspaceId}] ${msg}`;
    console.log(line);
    logs.push(msg);
  };

  log('Starting countFeatures…');

  const types = ['product', 'component', 'feature', 'subfeature'];
  const all = await pbClient.listAllEntities(types);

  log(`Fetched ${all.length} entit${all.length === 1 ? 'y' : 'ies'} across ${types.join(', ')}.`);

  const byType = {};
  for (const e of all) {
    const t = e.type || 'unknown';
    byType[t] = (byType[t] || 0) + 1;
  }
  for (const [type, count] of Object.entries(byType)) {
    log(`  ${type}: ${count}`);
  }

  const sample = all.slice(0, 5).map((e) => e.fields?.name).filter(Boolean);
  if (sample.length) {
    log(`Sample: ${sample.join(', ')}`);
  }

  log('countFeatures complete ✓');
  return { logs, summary: `${all.length} entities counted` };
}
