import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middleware/auth.js';
import { saveDeployment, getDeployments, getRunLogs } from '../services/firestore.js';
import { getToken } from '../services/secretManager.js';
import { createPBClient, createMockPBClient } from '../services/pbClient.js';
import { runSyncField } from '../scripts/syncField.js';

const router = Router();

const AVAILABLE_SCRIPTS = [
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

// GET /scripts — list available scripts
router.get('/', requireAuth, async (req, res) => {
  const deployments = await getDeployments(req.workspace.workspaceId);
  const scripts = AVAILABLE_SCRIPTS.map((s) => ({
    ...s,
    deployed: deployments.some((d) => d.scriptId === s.id),
  }));
  res.json({ scripts, deployments });
});

// POST /scripts/deploy — save config and create scheduler job
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
  };

  await saveDeployment(workspaceId, deployment);

  // Run the script immediately for first sync
  let logs = [];
  try {
    const pbClient = req.workspace.mock
      ? createMockPBClient()
      : createPBClient(await getToken(workspaceId));

    if (scriptId === 'syncField') {
      logs = await runSyncField(pbClient, config, workspaceId);
    }
  } catch (err) {
    logs = [`Error during initial sync: ${err.message}`];
  }

  const scheduleCronMap = {
    hourly: '0 * * * *',
    daily: '0 0 * * *',
    'on-change': 'webhook',
    manual: 'none',
  };

  res.json({
    jobId: `pb-${scriptId}-${deploymentId.slice(0, 8)}`,
    deploymentId,
    nextRun: config.schedule === 'manual'
      ? 'Manual trigger only'
      : config.schedule === 'on-change'
      ? 'On webhook event'
      : `Cron: ${scheduleCronMap[config.schedule]}`,
    logs,
  });
});

// POST /scripts/:id/run — manually trigger a script
router.post('/:id/run', requireAuth, async (req, res) => {
  const { id } = req.params;
  const workspaceId = req.workspace.workspaceId;

  const deployments = await getDeployments(workspaceId);
  const deployment = deployments.find((d) => d.id === id);

  if (!deployment) {
    return res.status(404).json({ message: 'Deployment not found' });
  }

  try {
    const pbClient = req.workspace.mock
      ? createMockPBClient()
      : createPBClient(await getToken(workspaceId));

    let logs = [];
    if (deployment.scriptId === 'syncField') {
      logs = await runSyncField(pbClient, deployment.config, workspaceId);
    }

    res.json({ status: 'completed', logs });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /scripts/:id/logs — fetch run logs
router.get('/:id/logs', requireAuth, async (req, res) => {
  const logs = await getRunLogs(req.workspace.workspaceId, req.params.id);
  res.json({ logs });
});

export default router;
