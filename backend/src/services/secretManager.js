import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

let client = null;
const mockSecrets = {};

function getClient() {
  if (process.env.NODE_ENV === 'mock' || !process.env.GCP_PROJECT_ID) {
    return null;
  }
  if (!client) {
    client = new SecretManagerServiceClient();
  }
  return client;
}

export async function storeToken(workspaceId, token) {
  // Always store in memory as a fallback
  mockSecrets[workspaceId] = token;

  const smClient = getClient();
  if (!smClient) return;

  const projectId = process.env.GCP_PROJECT_ID;
  const secretId = `pb-token-${workspaceId}`;
  const parent = `projects/${projectId}`;

  try {
    try {
      await smClient.createSecret({
        parent,
        secretId,
        secret: { replication: { automatic: {} } },
      });
    } catch (err) {
      if (err.code !== 6) throw err; // 6 = ALREADY_EXISTS
    }

    await smClient.addSecretVersion({
      parent: `${parent}/secrets/${secretId}`,
      payload: { data: Buffer.from(token) },
    });
  } catch (err) {
    // Secret Manager unavailable — token is still in mockSecrets for this session
    console.warn('Secret Manager unavailable, using in-memory token store:', err.message);
  }
}

export async function getToken(workspaceId) {
  const smClient = getClient();

  if (smClient) {
    const projectId = process.env.GCP_PROJECT_ID;
    const secretId = `pb-token-${workspaceId}`;

    try {
      const [version] = await smClient.accessSecretVersion({
        name: `projects/${projectId}/secrets/${secretId}/versions/latest`,
      });
      return version.payload.data.toString();
    } catch {
      // Fall through to in-memory
    }
  }

  return mockSecrets[workspaceId] || null;
}
