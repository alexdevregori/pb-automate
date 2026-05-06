/**
 * Routes that proxy to Productboard's API on behalf of the authenticated workspace.
 *
 * Currently exposes:
 *   GET /api/pb/fields   list of fields available for sync (custom + curated built-ins),
 *                        intersected across feature + subfeature so we only show fields
 *                        that exist on both parents and children.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getToken } from '../services/secretManager.js';
import { createPBClient } from '../services/pbClient.js';

const router = Router();

// Built-in fields the user can meaningfully sync. Anything else (e.g. `name`)
// gets filtered out so we don't tempt users into overwriting things they shouldn't.
const BUILTIN_ALLOWLIST = new Set([
  'tags',
  'health',
  'timeframe',
  'status',
  'owner',
]);

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function fieldsFromConfig(configResponse) {
  const fields = configResponse?.data?.fields || {};
  const out = [];
  for (const [key, def] of Object.entries(fields)) {
    const isCustom = UUID_RE.test(key);
    const isAllowedBuiltin = BUILTIN_ALLOWLIST.has(key);
    if (!isCustom && !isAllowedBuiltin) continue;
    out.push({
      key,                              // raw id (UUID for custom, slug for builtin)
      name: def.name || key,            // human label
      kind: isCustom ? 'custom' : 'builtin',
      type: def.schema?.type || 'unknown',
    });
  }
  return out;
}

router.get('/fields', requireAuth, async (req, res) => {
  const workspaceId = req.workspace.workspaceId;
  const token = await getToken(workspaceId);
  if (!token) {
    return res.status(401).json({ message: 'No PB token on file for this workspace.' });
  }
  const pb = createPBClient(token);

  let featureCfg, subfeatureCfg;
  try {
    [featureCfg, subfeatureCfg] = await Promise.all([
      pb.getEntityConfiguration('feature'),
      pb.getEntityConfiguration('subfeature'),
    ]);
  } catch (err) {
    const status = err.response?.status || 500;
    const detail = err.response?.data || err.message;
    console.error('PB configuration fetch failed:', detail);
    return res.status(502).json({
      message: 'Could not fetch field configurations from Productboard.',
      detail,
      pbStatus: status,
    });
  }

  const featureFields = fieldsFromConfig(featureCfg);
  const subfeatureFields = fieldsFromConfig(subfeatureCfg);

  // Keep only fields that exist on BOTH entity types — same field-name-on-both-ends
  // is what the syncField script requires.
  const subNames = new Set(subfeatureFields.map((f) => f.name));
  const intersection = featureFields
    .filter((f) => subNames.has(f.name))
    .sort((a, b) => {
      // Built-ins first, then custom — within each group alphabetical.
      if (a.kind !== b.kind) return a.kind === 'builtin' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  res.json({ fields: intersection });
});

export default router;
