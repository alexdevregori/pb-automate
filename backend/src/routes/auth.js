import { Router } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { storeToken } from '../services/secretManager.js';

const router = Router();

const PB_AUTH_URL = 'https://app.productboard.com/oauth2/authorize';
const PB_TOKEN_URL = 'https://app.productboard.com/oauth2/token';
const SCOPES = 'entities:read entities:write entities:delete notes:read notes:write notes:delete analytics:read members:read members:pii:read users:pii:read teams:read teams:write teams:delete webhooks:read webhooks:write webhooks:delete plugin-integrations:read plugin-integrations:write plugin-integrations:delete jira-integrations:read';

// In-memory store for PKCE code verifiers (keyed by state)
// In production, use a session store or Redis
const pkceStore = new Map();

function generatePKCE() {
  // Generate a random code_verifier (43-128 chars, URL-safe)
  const verifier = crypto.randomBytes(32).toString('base64url');
  // Create code_challenge as SHA256 hash of verifier, base64url-encoded
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

// GET /auth/login — redirect to Productboard OAuth with PKCE
router.get('/login', (req, res) => {
  const { verifier, challenge } = generatePKCE();
  const state = crypto.randomBytes(16).toString('base64url');

  // Store the verifier so we can use it in the callback
  pkceStore.set(state, verifier);
  // Clean up after 10 minutes
  setTimeout(() => pkceStore.delete(state), 10 * 60 * 1000);

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

  // Retrieve the PKCE code_verifier
  const codeVerifier = pkceStore.get(state);
  if (state) pkceStore.delete(state);

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
    const workspaceId = tokenRes.data.workspace_id || `ws-${Date.now()}`;

    await storeToken(workspaceId, access_token);

    const sessionToken = jwt.sign(
      { workspaceId },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/picker?token=${sessionToken}`);
  } catch (err) {
    console.error('OAuth callback error:', err.response?.data || err.message);
    res.status(500).json({ message: 'Failed to exchange authorization code' });
  }
});

// POST /auth/mock — create a mock session for local dev
router.post('/mock', (req, res) => {
  const workspaceId = 'mock-workspace';
  const token = jwt.sign(
    { workspaceId, mock: true },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: '24h' }
  );
  res.json({ token, workspaceId });
});

export default router;
