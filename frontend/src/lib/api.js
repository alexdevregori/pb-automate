import { getSessionId } from './events.js';

const API_BASE = '/api';

async function request(path, options = {}) {
  const token = localStorage.getItem('pb_token');
  const sessionId = getSessionId();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(sessionId ? { 'X-PH-SESSION-ID': sessionId } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    const err = new Error(body.message || 'Request failed');
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export function getScripts() {
  return request('/scripts');
}

export function deployScript(config) {
  return request('/scripts/deploy', {
    method: 'POST',
    body: JSON.stringify(config),
  });
}

export function runScript(id) {
  return request(`/scripts/${id}/run`, { method: 'POST' });
}

export function getScriptLogs(id) {
  return request(`/scripts/${id}/logs`);
}

export function getScript(id) {
  return request(`/scripts/${id}`);
}

export function pauseScript(id, paused) {
  return request(`/scripts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ paused }),
  });
}

export function updateDeployment(id, patch) {
  return request(`/scripts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export function deleteScript(id) {
  return request(`/scripts/${id}`, { method: 'DELETE' }).catch(() => ({}));
}

export function getAvailableFields({ parentType, childTypes } = {}) {
  const params = new URLSearchParams();
  if (parentType) params.set('parentType', parentType);
  for (const t of childTypes || []) params.append('childType[]', t);
  const qs = params.toString();
  return request(`/pb/fields${qs ? `?${qs}` : ''}`);
}

export function getHierarchy() {
  return request('/pb/hierarchy');
}

export function checkPBStatus() {
  return request('/pb/status');
}
