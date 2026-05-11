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

// Cheap liveness check — verifies the stored PB token is still accepted.
// Returns 401 if PB rejects it (e.g. OAuth app was removed by the user).
// Returns { connected: true } for transient PB errors so we never log users
// out during a PB outage.
router.get('/status', requireAuth, async (req, res) => {
  const workspaceId = req.workspace.workspaceId;
  const token = await getToken(workspaceId);
  if (!token) return res.status(401).json({ connected: false, reason: 'no_token' });

  const pb = createPBClient(token);
  try {
    await pb.getEntityConfiguration('feature');
    res.json({ connected: true });
  } catch (err) {
    const status = err.response?.status;
    if (status === 401 || status === 403) {
      return res.status(401).json({ connected: false, reason: 'token_revoked' });
    }
    // PB outage or network error — don't sign the user out
    res.json({ connected: true, warning: 'Could not verify' });
  }
});

function fieldsFromConfig(configResponse) {
  const fields = configResponse?.data?.fields || {};
  const out = [];
  for (const [key, def] of Object.entries(fields)) {
    if (!UUID_RE.test(key)) continue;
    out.push({
      key,
      name: def.name || key,
      schema: {
        type: def.schema?.type,
        format: def.schema?.format,
        required: def.schema?.required,
        constraints: def.schema?.constraints,
      },
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

  // Show all custom fields from the parent type. For each field, also report
  // which child types don't have it configured so the UI can warn the user.
  const parentFields = fieldsFromConfig(configs[0]);
  const childTypeList = types.slice(1);
  const childFieldNameSets = configs.slice(1).map((c) => new Set(fieldsFromConfig(c).map((f) => f.name)));

  const fields = parentFields
    .map((f) => ({
      ...f,
      missingFrom: childTypeList.filter((_, i) => !childFieldNameSets[i].has(f.name)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  res.json({ fields, types });
});

export default router;
