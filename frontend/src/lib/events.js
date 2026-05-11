/**
 * Client-side event tracking.
 *
 * posthog-js handles session replay (routed via /api/ingest on our backend to
 * avoid ad-blocker interception). Business events (script_deployed, etc.) are
 * relayed server-side via /api/events so they can be enriched with server
 * context and still fire even when posthog-js hasn't loaded.
 *
 * $session_id is read from posthog.get_session_id() so replay events and
 * business events are stitched into the same PostHog session timeline.
 */

import posthog from 'posthog-js';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;

let _distinctId = null;
let _initialized = false;

export function initAnalytics() {
  if (!POSTHOG_KEY || _initialized) return;
  posthog.init(POSTHOG_KEY, {
    api_host: '/api/ingest',
    autocapture: false,
    capture_pageview: false,
    session_recording: {
      maskAllInputs: true,
      maskAllText: false,
    },
  });
  _initialized = true;
}

export function getSessionId() {
  if (_initialized) return posthog.get_session_id() || '';
  return sessionStorage.getItem('ph_session_id') || '';
}

export function identify(distinctId, properties = {}) {
  _distinctId = distinctId;
  if (_initialized) posthog.identify(distinctId, properties);
  fire('/api/events/identify', { distinctId, properties });
}

export function capture(event, properties = {}) {
  if (!_distinctId) return;
  fire('/api/events', {
    event,
    distinctId: _distinctId,
    properties: { ...properties, $session_id: getSessionId() },
  });
}

export function reset() {
  _distinctId = null;
  if (_initialized) posthog.reset();
  sessionStorage.removeItem('ph_session_id');
}

function fire(path, body) {
  fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => {});
}
