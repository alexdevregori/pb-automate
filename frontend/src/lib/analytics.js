/**
 * Client-side analytics (PostHog).
 *
 * Loaded once at app boot via initAnalytics(). All other helpers are safe to
 * call even before init — they no-op until posthog is ready.
 *
 * Env vars (Vite, must be prefixed VITE_):
 *   VITE_POSTHOG_KEY   the project ingest key (phc_…)
 *   VITE_POSTHOG_HOST  default: https://us.i.posthog.com
 */
import posthog from 'posthog-js';

let initialized = false;

export function initAnalytics() {
  if (initialized) return;
  const key = import.meta.env.VITE_POSTHOG_KEY;
  if (!key) {
    // Silently no-op when no key configured. Useful for CI / local without keys.
    return;
  }
  posthog.init(key, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
    capture_pageview: true,
    persistence: 'localStorage',
    // Don't try to fetch feature flags on boot; we don't use them yet.
    advanced_disable_feature_flags: true,
  });
  initialized = true;
}

export function identify(distinctId, properties = {}) {
  if (!initialized) return;
  posthog.identify(distinctId, properties);
}

export function capture(event, properties = {}) {
  if (!initialized) return;
  posthog.capture(event, properties);
}

export function reset() {
  if (!initialized) return;
  posthog.reset();
}
