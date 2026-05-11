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

export async function getDeployment(workspaceId, deploymentId) {
  const firestore = getDB();
  if (!firestore) {
    return mockStore[`${workspaceId}/deployments/${deploymentId}`] || null;
  }
  const snap = await firestore
    .collection(COLLECTION).doc(workspaceId)
    .collection('deployments').doc(deploymentId).get();
  return snap.exists ? snap.data() : null;
}

export async function patchDeployment(workspaceId, deploymentId, patch) {
  const firestore = getDB();
  if (!firestore) {
    const key = `${workspaceId}/deployments/${deploymentId}`;
    if (mockStore[key]) mockStore[key] = { ...mockStore[key], ...patch };
    return mockStore[key] || null;
  }
  await firestore.collection(COLLECTION).doc(workspaceId)
    .collection('deployments').doc(deploymentId).update(patch);
  return getDeployment(workspaceId, deploymentId);
}

export async function deleteDeployment(workspaceId, deploymentId) {
  const firestore = getDB();
  if (!firestore) {
    delete mockStore[`${workspaceId}/deployments/${deploymentId}`];
    return;
  }
  await firestore.collection(COLLECTION).doc(workspaceId)
    .collection('deployments').doc(deploymentId).delete();
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

export async function savePkceVerifier(state, verifier) {
  const firestore = getDB();
  const expiresAt = Date.now() + 10 * 60 * 1000;
  if (!firestore) {
    mockStore[`pkce/${state}`] = { verifier, expiresAt };
    return;
  }
  await firestore
    .collection(COLLECTION).doc('pkce')
    .collection('verifiers').doc(state)
    .set({ verifier, expiresAt });
}

export async function popPkceVerifier(state) {
  const firestore = getDB();
  if (!firestore) {
    const entry = mockStore[`pkce/${state}`];
    delete mockStore[`pkce/${state}`];
    if (!entry || entry.expiresAt < Date.now()) return null;
    return entry.verifier;
  }
  const ref = firestore
    .collection(COLLECTION).doc('pkce')
    .collection('verifiers').doc(state);
  const snap = await ref.get();
  if (!snap.exists) return null;
  await ref.delete();
  const { verifier, expiresAt } = snap.data();
  if (expiresAt < Date.now()) return null;
  return verifier;
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
