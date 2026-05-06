/**
 * Routes that proxy to Productboard's V2 API on behalf of the authenticated workspace.
 *
 * GET /api/pb/fields
 *   Query: ?parentType=product&childType[]=component&childType[]=feature
 *   Returns the intersection of fields available on every type listed
 *   (parentType + each childType), so the UI only shows fields that exist
 *   on every entity involved in a sync.
 *
 *   Both parentType and childType[] are optional. If both omitted, returns
 *   the intersection of `feature` and `subfeature` (the original default).
 *
 * GET /api/pb/hierarchy
 *   Returns the static hierarchy table the UI uses to constrain the
 *   parent-type / child-types pickers. Cheap and deterministic — no PB call.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getToken } from '../services/secretManager.js';
import { createPBClient } from '../services/pbClient.js';

const router = Router();

// Built-in fields that are meaningful to sync. Anything not in this list and
// not a UUID gets filtered out.
const BUILTIN_ALLOWLIST = new Set(['tags', 'health', 'timeframe', 'status', 'owner']);

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

// Static hierarchy of valid parent → child relationships in the PB data model.
// Drives the UI's child-type picker.
const HIERARCHY = {
  product:   ['component', 'feature', 'subfeature'],
  component: ['component', 'feature', 'subfeature'],
  feature:   ['subfeature'],
  release:   ['initiative', 'feature', 'subfeature'],
  objective: ['keyResult', 'objective', 'initiative', 'feature', 'subfeature'],
};

router.get('/hierarchy', requireAuth, (_req, res) => {
  res.json({ hierarchy: HIERARCHY });
});

function fieldsFromConfig(configResponse) {
  const fields = configResponse?.data?.fields || {};
  const out = [];
  for (const [key, def] of Object.entries(fields)) {
    const isCustom = UUID_RE.test(key);
    const isAllowedBuiltin = BUILTIN_ALLOWLIST.has(key);
    if (!isCustom && !isAllowedBuiltin) continue;
    out.push({
      key,
      name: def.name || key,
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

  // Parse types from query.
  const parentType = req.query.parentType;
  let childTypes = req.query['childType'] || req.query['childType[]'];
  if (typeof childTypes === 'string') childTypes = [childTypes];
  if (!Array.isArray(childTypes)) childTypes = [];

  // Default: feature + subfeature (matches earlier behavior of the endpoint
  // before it was parameterized).
  const types = parentType
    ? Array.from(new Set([parentType, ...childTypes].filter(Boolean)))
    : ['feature', 'subfeature'];

  if (!types.length) {
    return res.status(400).json({ message: 'No entity types specified.' });
  }

  const pb = createPBClient(token);

  let configs;
  try {
    configs = await Promise.all(types.map((t) => pb.getEntityConfiguration(t)));
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

  // Intersect across every type — only keep field NAMES that appear in all.
  const perTypeFields = configs.map(fieldsFromConfig);
  const nameSets = perTypeFields.map((arr) => new Set(arr.map((f) => f.name)));
  const intersection = perTypeFields[0]
    .filter((f) => nameSets.every((s) => s.has(f.name)))
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'builtin' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  res.json({ fields: intersection, types });
});

export default router;
