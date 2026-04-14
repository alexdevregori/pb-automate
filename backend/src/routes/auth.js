import { Router } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { storeToken } from '../services/secretManager.js';

const router = Router();

const PB_AUTH_URL = 'https://app.productboard.com/oauth/authorize';
const PB_TOKEN_URL = 'https://app.productboard.com/oauth/token';
const SCOPES = 'entities:read entities:write entities:delete notes:read notes:write notes:delete analytics:read members:read members:pii:read users:pii:read teams:read teams:write teams:delete webhooks:read webhooks:write webhooks:delete plugin-integrations:read plugin-integrations:write plugin-integrations:delete jira-integrations:read';

// GET /auth/login — redirect to Productboard OAuth
// Accepts optional ?workspace= param to store the workspace URL for later
router.get('/login', (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.PB_CLIENT_ID,
    redirect_uri: process.env.PB_REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
  });
  // Pass workspace URL through OAuth state param so we get it back in callback
  if (req.query.workspace) {
    params.set('state', req.query.workspace);
  }
  res.redirect(`${PB_AUTH_URL}?${params.toString()}`);
});

// GET /auth/callback — exchange code for token
router.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).json({ message: 'Missing authorization code' });
  }

  try {
    const tokenRes = await axios.post(PB_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: process.env.PB_CLIENT_ID,
        client_secret: process.env.PB_CLIENT_SECRET,
        redirect_uri: process.env.PB_REDIRECT_URI,
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token } = tokenRes.data;
    // Derive workspace ID from the token response or use a hash
    const workspaceId = tokenRes.data.workspace_id || `ws-${Date.now()}`;

    await storeToken(workspaceId, access_token);

    const sessionToken = jwt.sign(
      { workspaceId },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Redirect to frontend with token
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
