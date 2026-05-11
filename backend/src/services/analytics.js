/**
 * Server-side analytics (PostHog).
 *
 * Singleton client. If POSTHOG_KEY isn't set, every call is a no-op so local
 * dev / tests don't have to configure analytics.
 *
 * Usage:
 *   import { capture } from '../services/analytics.js';
 *   capture('script_deployed', workspaceId, { scriptId, schedule });
 */
import { PostHog } from 'posthog-node';

let client = null;

function getClient() {
  if (client !== null) return client;
  const key = process.env.POSTHOG_KEY;
  if (!key) {
    client = false; // explicit "no-op" sentinel
    return null;
  }
  client = new PostHog(key, {
    host: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
    // Reasonable defaults: short flush interval keeps event lag low in dev,
    // batches in prod via the underlying queue.
    flushAt: 1,
    flushInterval: 1000,
  });
  return client;
}

export function capture(event, distinctId, properties = {}) {
  const c = getClient();
  if (!c) return;
  try {
    c.capture({
      distinctId: distinctId || 'anonymous',
      event,
      properties,
    });
  } catch (err) {
    // Never let analytics break a request.
    console.error('[analytics] capture failed:', err.message);
  }
}

export function identify(distinctId, properties = {}) {
  const c = getClient();
  if (!c) return;
  try {
    c.identify({ distinctId, properties });
  } catch (err) {
    console.error('[analytics] identify failed:', err.message);
  }
}

// Optional: graceful shutdown so in-flight events get flushed before process exit.
export async function shutdown() {
  if (client && client !== false) {
    await client.shutdown().catch(() => {});
  }
}
