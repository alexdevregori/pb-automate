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
  const smClient = getClient();
  if (!smClient) {
    mockSecrets[workspaceId] = token;
    return;
  }

  const projectId = process.env.GCP_PROJECT_ID;
  const secretId = `pb-token-${workspaceId}`;
  const parent = `projects/${projectId}`;

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
}

export async function getToken(workspaceId) {
  const smClient = getClient();
  if (!smClient) {
    return mockSecrets[workspaceId] || null;
  }

  const projectId = process.env.GCP_PROJECT_ID;
  const secretId = `pb-token-${workspaceId}`;

  try {
    const [version] = await smClient.accessSecretVersion({
      name: `projects/${projectId}/secrets/${secretId}/versions/latest`,
    });
    return version.payload.data.toString();
  } catch {
    return null;
  }
}
