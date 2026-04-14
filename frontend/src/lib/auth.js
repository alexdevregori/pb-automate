const PB_AUTH_URL = 'https://app.productboard.com/oauth2/authorize';
const SCOPES = 'features:read features:write custom-fields:read custom-fields:write';

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
