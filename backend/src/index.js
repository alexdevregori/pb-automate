import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import scriptsRoutes from './routes/scripts.js';
import webhooksRoutes from './routes/webhooks.js';
import pbRoutes from './routes/pb.js';

import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// PostHog ingest proxy — registered before express.json() so the body stays as a
// raw Buffer that can be forwarded byte-for-byte (session replay sends binary blobs).
app.use('/api/ingest', express.raw({ type: '*/*', limit: '10mb' }), async (req, res) => {
  const host = process.env.POSTHOG_HOST || 'https://us.i.posthog.com';
  const target = `${host}${req.url}`;
  try {
    const headers = { ...req.headers };
    delete headers.host;
    delete headers['content-length'];
    delete headers['content-encoding'];
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
    });
    const data = await upstream.arrayBuffer();
    res.status(upstream.status);
    const ct = upstream.headers.get('content-type');
    if (ct) res.set('content-type', ct);
    res.send(Buffer.from(data));
  } catch (err) {
    console.error('[ingest-proxy]', err.message);
    res.status(502).json({ error: 'proxy error' });
  }
});

app.use(express.json());
app.use(cookieParser());

// Tiny request logger so we can see what's actually hitting the backend
app.use((req, _res, next) => {
  console.log(`→ ${req.method} ${req.url}`);
  next();
});

// Relay frontend events through the server-side PostHog client so posthog-js
// never makes a direct browser request (which ad blockers intercept).
import { capture as serverCapture, identify as serverIdentify } from './services/analytics.js';
app.post('/api/events', (req, res) => {
  const { event, distinctId, properties } = req.body || {};
  if (event && distinctId) serverCapture(event, distinctId, properties || {});
  res.status(204).end();
});
app.post('/api/events/identify', (req, res) => {
  const { distinctId, properties } = req.body || {};
  if (distinctId) serverIdentify(distinctId, properties || {});
  res.status(204).end();
});

// API routes mounted under /api so frontend (served from same origin) can call them
app.use('/api/auth', authRoutes);
app.use('/api/scripts', scriptsRoutes);
app.use('/api/webhooks', webhooksRoutes);
app.use('/api/pb', pbRoutes);

// Keep /auth for direct OAuth redirect URIs registered in the PB OAuth app
app.use('/auth', authRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve built frontend (multi-stage Docker copies frontend/dist to /app/public)
const publicDir = resolve(__dirname, '..', 'public');
if (existsSync(publicDir)) {
  app.use(express.static(publicDir));
  // SPA fallback — any non-API route returns index.html so React Router handles it
  app.get(/^\/(?!api|auth|health|webhooks|scripts|pb).*/, (req, res) => {
    res.sendFile(join(publicDir, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`PB Automate backend running on port ${PORT}`);
});
