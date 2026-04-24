import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import scriptsRoutes from './routes/scripts.js';
import webhooksRoutes from './routes/webhooks.js';

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
app.use(express.json());
app.use(cookieParser());

// API routes mounted under /api so frontend (served from same origin) can call them
app.use('/api/auth', authRoutes);
app.use('/api/scripts', scriptsRoutes);
app.use('/api/webhooks', webhooksRoutes);

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
  app.get(/^\/(?!api|auth|health|webhooks|scripts).*/, (req, res) => {
    res.sendFile(join(publicDir, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`PB Automate backend running on port ${PORT}`);
});
