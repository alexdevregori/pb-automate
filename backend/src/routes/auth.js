import { Router } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { storeToken } from '../services/secretManager.js';
import { savePkceVerifier, popPkceVerifier } from '../services/firestore.js';
import { capture, identify } from '../services/analytics.js';

const router = Router();

const PB_AUTH_URL = 'https://app.productboard.com/oauth2/authorize';
const PB_TOKEN_URL = 'https://app.productboard.com/oauth2/token';
const SCOPES = 'entities:read entities:write entities:delete notes:read notes:write notes:delete analytics:read members:read members:pii:read users:pii:read teams:read teams:write teams:delete webhooks:read webhooks:write webhooks:delete plugin-integrations:read plugin-integrations:write plugin-integrations:delete jira-integrations:read';

function generatePKCE() {
  // Generate a random code_verifier (43-128 chars, URL-safe)
  const verifier = crypto.randomBytes(32).toString('base64url');
  // Create code_challenge as SHA256 hash of verifier, base64url-encoded
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

// GET /auth/login — redirect to Productboard OAuth with PKCE
router.get('/login', async (req, res) => {
  const { verifier, challenge } = generatePKCE();
  const state = crypto.randomBytes(16).toString('base64url');

  await savePkceVerifier(state, verifier);

  const params = new URLSearchParams({
    client_id: process.env.PB_CLIENT_ID,
    redirect_uri: process.env.PB_REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });

  res.redirect(`${PB_AUTH_URL}?${params.toString()}`);
});

// GET /auth/callback — exchange code for token
router.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code) {
    return res.status(400).json({ message: 'Missing authorization code' });
  }

  const codeVerifier = state ? await popPkceVerifier(state) : null;

  try {
    const params = {
      grant_type: 'authorization_code',
      code,
      client_id: process.env.PB_CLIENT_ID,
      client_secret: process.env.PB_CLIENT_SECRET,
      redirect_uri: process.env.PB_REDIRECT_URI,
    };
    if (codeVerifier) {
      params.code_verifier = codeVerifier;
    }

    // PB expects token exchange params as query parameters
    const tokenUrl = `${PB_TOKEN_URL}?${new URLSearchParams(params).toString()}`;
    const tokenRes = await axios.post(tokenUrl);

    const { access_token } = tokenRes.data;

    // Derive a stable workspace ID from the access token's JWT payload (sub claim).
    // Falls back to workspace_id in the token response, then a timestamp (unstable).
    let workspaceId = tokenRes.data.workspace_id;
    if (!workspaceId) {
      try {
        const [, payload] = access_token.split('.');
        if (payload) {
          const decoded = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
          const stableId = decoded.sub || decoded.user_id || decoded.userId || decoded.uid;
          if (stableId) workspaceId = `pb-${stableId}`;
        }
      } catch {
        // opaque token — fall through to timestamp
      }
    }
    workspaceId = workspaceId || `ws-${Date.now()}`;

    await storeToken(workspaceId, access_token);

    identify(workspaceId, { authMethod: 'oauth' });
    capture('login_succeeded', workspaceId, { authMethod: 'oauth' });

    const sessionToken = jwt.sign(
      { workspaceId },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Redirect to frontend dashboard. If FRONTEND_URL is set use it (dev),
    // otherwise use a same-origin relative redirect (prod: frontend served by this backend).
    const frontendUrl = process.env.FRONTEND_URL;
    const target = frontendUrl
      ? `${frontendUrl}/dashboard?token=${sessionToken}`
      : `/dashboard?token=${sessionToken}`;
    res.redirect(target);
  } catch (err) {
    const errData = err.response?.data || err.message;
    console.error('OAuth callback error:', JSON.stringify(errData));
    console.error('OAuth callback status:', err.response?.status);
    res.status(500).json({ message: 'Failed to exchange authorization code', detail: errData });
  }
});

// POST /auth/token — exchange a user-provided PB API token for a session.
// Validates the token against the PB API before storing it.
router.post('/token', async (req, res) => {
  const { token: pbToken } = req.body || {};
  if (!pbToken || typeof pbToken !== 'string' || pbToken.length < 10) {
    return res.status(400).json({ message: 'Missing or invalid PB API token' });
  }

  // Reject anything with whitespace — common paste error (full stack traces, etc.)
  if (/\s/.test(pbToken)) {
    return res.status(400).json({
      message: 'Token contains whitespace — make sure you copied just the token string.',
    });
  }

  // Validate the token with a cheap PB API call before persisting it.
  try {
    await axios.get('https://api.productboard.com/features', {
      headers: {
        Authorization: `Bearer ${pbToken}`,
        'X-Version': '1',
      },
      params: { pageLimit: 1 },
      timeout: 10000,
    });
  } catch (err) {
    const status = err.response?.status;
    if (status === 401 || status === 403) {
      return res.status(401).json({
        message: 'Productboard rejected the token. Double-check it was copied correctly and is still valid.',
      });
    }
    console.error('PB validation call failed:', err.message);
    return res.status(502).json({
      message: `Could not reach Productboard to validate the token (${err.message}).`,
    });
  }

  // Deterministic workspace ID derived from the token so the same token always
  // maps to the same stored secret / deployments.
  const workspaceId = `pat-${crypto.createHash('sha256').update(pbToken).digest('hex').slice(0, 12)}`;

  try {
    await storeToken(workspaceId, pbToken);
  } catch (err) {
    console.error('Failed to store PB token:', err.message);
    return res.status(500).json({ message: 'Failed to store token' });
  }

  const sessionToken = jwt.sign(
    { workspaceId },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: '24h' }
  );

  identify(workspaceId, { authMethod: 'api_token' });
  capture('login_succeeded', workspaceId, { authMethod: 'api_token' });

  res.json({ token: sessionToken, workspaceId });
});

export default router;
