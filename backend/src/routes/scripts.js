import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middleware/auth.js';
import { saveDeployment, getDeployments, getDeployment, saveRunLog, getRunLogs, patchDeployment, deleteDeployment } from '../services/firestore.js';
import { getToken } from '../services/secretManager.js';
import { createPBClient } from '../services/pbClient.js';
import { runSyncField } from '../scripts/syncField.js';
import { runCountFeatures } from '../scripts/countFeatures.js';
import { capture } from '../services/analytics.js';

const router = Router();

const AVAILABLE_SCRIPTS = [
  {
    id: 'countFeatures',
    name: 'Count Features (Smoke Test)',
    description: 'Read-only: counts features in your workspace. Use to verify the deploy pipeline works.',
  },
  {
    id: 'syncField',
    name: 'Sync Custom Field',
    description: 'Sync a custom field value between parent and child features.',
  },
  {
    id: 'rollupScore',
    name: 'Roll Up Priority Score',
    description: 'Aggregate child priority scores to the parent feature level.',
  },
  {
    id: 'propagateTags',
    name: 'Propagate Tags',
    description: 'Copy tags from parent features down to all child sub-features.',
  },
];

async function executeScript(scriptId, pbClient, config, workspaceId) {
  if (scriptId === 'syncField') return runSyncField(pbClient, config, workspaceId);
  if (scriptId === 'countFeatures') return runCountFeatures(pbClient, config, workspaceId);
  throw new Error(`No runner registered for scriptId="${scriptId}"`);
}

async function runAndPersist(deployment, pbClient, workspaceId) {
  const runId = uuidv4();
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  try {
    const { logs, summary } = await executeScript(
      deployment.scriptId, pbClient, deployment.config, workspaceId
    );
    const run = {
      runId, deploymentId: deployment.id, status: 'ok', startedAt,
      durationMs: Date.now() - t0, summary, logs,
    };
    await saveRunLog(workspaceId, run);
    return run;
  } catch (err) {
    console.error('Script run failed:', err);
    const run = {
      runId, deploymentId: deployment.id, status: 'fail', startedAt,
      durationMs: Date.now() - t0,
      summary: err.message || 'Run failed',
      logs: [`Error: ${err.message}`],
      error: err.message,
    };
    await saveRunLog(workspaceId, run);
    return run;
  }
}

// GET /scripts — list available scripts + deployments enriched with run history
router.get('/', requireAuth, async (req, res) => {
  const workspaceId = req.workspace.workspaceId;
  const deployments = await getDeployments(workspaceId);

  const enriched = await Promise.all(
    deployments.map(async (d) => {
      const runs = await getRunLogs(workspaceId, d.id);
      return { ...d, latestRun: runs[0] || null, recentRuns: runs.slice(0, 7) };
    })
  );

  const scripts = AVAILABLE_SCRIPTS.map((s) => ({
    ...s,
    deployed: enriched.some((d) => d.scriptId === s.id),
  }));
  res.json({ scripts, deployments: enriched });
});

// POST /scripts/deploy — save config and run immediately
router.post('/deploy', requireAuth, async (req, res) => {
  const { scriptId, ...config } = req.body;
  const deploymentId = uuidv4();
  const workspaceId = req.workspace.workspaceId;

  const deployment = {
    id: deploymentId,
    scriptId,
    config,
    workspaceId,
    status: 'active',
    schedule: config.schedule || 'manual',
    createdAt: new Date().toISOString(),
  };

  await saveDeployment(workspaceId, deployment);

  const pbClient = createPBClient(await getToken(workspaceId));
  const run = await runAndPersist(deployment, pbClient, workspaceId);

  console.log(`✓ deployed ${scriptId} (${deploymentId.slice(0, 8)}) — run ${run.status}, ${run.logs.length} log line(s)`);

  capture('script_deployed', workspaceId, {
    scriptId,
    schedule: deployment.schedule,
    dryRun: !!config?.dryRun,
    firstRunStatus: run.status,
  });

  res.json({ deployment, run });
});

// POST /scripts/:id/run — manually trigger a script
router.post('/:id/run', requireAuth, async (req, res) => {
  const workspaceId = req.workspace.workspaceId;
  const deployment = await getDeployment(workspaceId, req.params.id);

  if (!deployment) {
    return res.status(404).json({ message: 'Deployment not found' });
  }

  // Diagnostic — show exactly what config is being used.
  console.log(
    `[run] ${deployment.scriptId} (${req.params.id.slice(0, 8)}) ` +
    `dryRun=${deployment.config?.dryRun} ` +
    `overwrite=${deployment.config?.overwriteExisting} ` +
    `field="${deployment.config?.fieldName}"`
  );

  const pbClient = createPBClient(await getToken(workspaceId));
  const run = await runAndPersist(deployment, pbClient, workspaceId);

  capture('script_run_completed', workspaceId, {
    scriptId: deployment.scriptId,
    deploymentId: deployment.id,
    status: run.status,
    durationMs: run.durationMs,
    dryRun: !!deployment.config?.dryRun,
  });

  res.json({ run });
});

// GET /scripts/:id — deployment + recent runs
router.get('/:id', requireAuth, async (req, res) => {
  const workspaceId = req.workspace.workspaceId;
  const deployment = await getDeployment(workspaceId, req.params.id);
  if (!deployment) return res.status(404).json({ message: 'Deployment not found' });
  const runs = await getRunLogs(workspaceId, req.params.id);
  res.json({ deployment, runs });
});

// PATCH /scripts/:id — pause/resume or update config
router.patch('/:id', requireAuth, async (req, res) => {
  const workspaceId = req.workspace.workspaceId;
  const updated = await patchDeployment(workspaceId, req.params.id, req.body);
  if (!updated) return res.status(404).json({ message: 'Deployment not found' });

  // Distinguish pause/resume from full config edit for cleaner analytics.
  if (Object.keys(req.body || {}).length === 1 && 'paused' in req.body) {
    capture(req.body.paused ? 'script_paused' : 'script_resumed', workspaceId, {
      scriptId: updated.scriptId,
      deploymentId: updated.id,
    });
  } else {
    capture('script_updated', workspaceId, {
      scriptId: updated.scriptId,
      deploymentId: updated.id,
      patchedKeys: Object.keys(req.body || {}),
    });
  }
  res.json(updated);
});

// DELETE /scripts/:id
router.delete('/:id', requireAuth, async (req, res) => {
  const workspaceId = req.workspace.workspaceId;
  await deleteDeployment(workspaceId, req.params.id);
  capture('script_deleted', workspaceId, { deploymentId: req.params.id });
  res.status(204).end();
});

export default router;
