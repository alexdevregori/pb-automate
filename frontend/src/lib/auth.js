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
