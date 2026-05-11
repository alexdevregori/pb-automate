const PB_AUTH_URL = 'https://app.productboard.com/oauth/authorize';
const SCOPES = 'entities:read entities:write entities:delete notes:read notes:write notes:delete analytics:read members:pii:read users:pii:read teams:read teams:write teams:delete webhooks:read webhooks:write webhooks:delete plugin-integrations:read plugin-integrations:write plugin-integrations:delete jira-integrations:read';

export function getOAuthURL(clientId, redirectUri) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES,
  });
  return `${PB_AUTH_URL}?${params.toString()}`;
}

export function setToken(token) {
  localStorage.setItem('pb_token', token);
}

export function getToken() {
  return localStorage.getItem('pb_token');
}

export function clearToken() {
  localStorage.removeItem('pb_token');
}

export function isAuthenticated() {
  return !!getToken();
}

/** Decode the JWT payload (no verification — server signs, client just reads). */
export function decodeToken(token) {
  if (!token) return null;
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    // Convert URL-safe base64 to standard base64 for atob.
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(b64));
  } catch {
    return null;
  }
}

export function getWorkspaceId() {
  return decodeToken(getToken())?.workspaceId || null;
}
