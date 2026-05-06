import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let db = null;
let mockStore = {};

function getDB() {
  if (process.env.NODE_ENV === 'mock' || !process.env.GCP_PROJECT_ID) {
    return null; // Use mock store
  }
  if (!db) {
    if (getApps().length === 0) {
      initializeApp({ projectId: process.env.GCP_PROJECT_ID });
    }
    db = getFirestore();
  }
  return db;
}

const COLLECTION = process.env.FIRESTORE_COLLECTION || 'pb_automate';

export async function saveDeployment(workspaceId, deployment) {
  const firestore = getDB();
  if (!firestore) {
    const key = `${workspaceId}/deployments/${deployment.id}`;
    mockStore[key] = { ...deployment, createdAt: new Date().toISOString() };
    return deployment;
  }
  await firestore
    .collection(COLLECTION)
    .doc(workspaceId)
    .collection('deployments')
    .doc(deployment.id)
    .set({ ...deployment, createdAt: new Date().toISOString() });
  return deployment;
}

export async function getDeployments(workspaceId) {
  const firestore = getDB();
  if (!firestore) {
    return Object.entries(mockStore)
      .filter(([k]) => k.startsWith(`${workspaceId}/deployments/`))
      .map(([, v]) => v);
  }
  const snap = await firestore
    .collection(COLLECTION)
    .doc(workspaceId)
    .collection('deployments')
    .orderBy('createdAt', 'desc')
    .get();
  return snap.docs.map((d) => d.data());
}

export async function saveRunLog(workspaceId, run) {
  const firestore = getDB();
  const doc = {
    runId: run.runId,
    deploymentId: run.deploymentId,
    status: run.status,             // 'ok' | 'fail'
    startedAt: run.startedAt,       // ISO string
    durationMs: run.durationMs,
    summary: run.summary,
    logs: run.logs,                 // string[]
    error: run.error || null,
  };
  if (!firestore) {
    const key = `${workspaceId}/logs/${run.deploymentId}/${run.runId}`;
    mockStore[key] = doc;
    return doc;
  }
  await firestore
    .collection(COLLECTION)
    .doc(workspaceId)
    .collection('logs')
    .doc(run.runId)
    .set(doc);
  return doc;
}

export async function getRunLogs(workspaceId, deploymentId) {
  const firestore = getDB();
  if (!firestore) {
    return Object.entries(mockStore)
      .filter(([k]) => k.startsWith(`${workspaceId}/logs/${deploymentId}/`))
      .map(([, v]) => v)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }
  const snap = await firestore
    .collection(COLLECTION)
    .doc(workspaceId)
    .collection('logs')
    .where('deploymentId', '==', deploymentId)
    .orderBy('startedAt', 'desc')
    .get();
  return snap.docs.map((d) => d.data());
}
