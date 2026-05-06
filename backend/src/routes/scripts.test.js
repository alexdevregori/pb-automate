import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import scriptsRoutes from './scripts.js';

const SECRET = 'test-secret';

beforeAll(() => {
  process.env.JWT_SECRET = SECRET;
  // Force firestore + secretManager services to use their in-memory mocks
  process.env.GCP_PROJECT_ID = '';
});

function makeToken(workspaceId = 'ws-test') {
  return jwt.sign({ workspaceId }, SECRET);
}

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/scripts', scriptsRoutes);
  return app;
}

describe('GET /scripts/:id', () => {
  it('returns 404 when the deployment does not exist', async () => {
    const app = makeApp();
    const res = await request(app)
      .get('/scripts/does-not-exist')
      .set('Authorization', `Bearer ${makeToken()}`);
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/not found/i);
  });

  it('returns 401 without an auth token', async () => {
    const app = makeApp();
    const res = await request(app).get('/scripts/anything');
    expect(res.status).toBe(401);
  });
});

describe('DELETE /scripts/:id', () => {
  it('returns 401 without an auth token', async () => {
    const app = makeApp();
    const res = await request(app).delete('/scripts/anything');
    expect(res.status).toBe(401);
  });

  it('returns 204 when authed (no-op for missing deployment is fine)', async () => {
    const app = makeApp();
    const res = await request(app)
      .delete('/scripts/does-not-exist')
      .set('Authorization', `Bearer ${makeToken()}`);
    expect(res.status).toBe(204);
  });
});

describe('PATCH /scripts/:id', () => {
  it('returns 404 when the deployment does not exist', async () => {
    const app = makeApp();
    const res = await request(app)
      .patch('/scripts/does-not-exist')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ paused: true });
    expect(res.status).toBe(404);
  });
});
