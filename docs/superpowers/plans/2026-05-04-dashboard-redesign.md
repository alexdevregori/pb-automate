# PB Automate Dashboard Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the wizard-only app with a dashboard-anchored experience: side-nav chrome, scripts list home, restructured 3-step add-script wizard, and split-view detail page.

**Architecture:** Frontend gains a persistent `AppLayout` (sidenav + content area) wrapping all authenticated routes. Routes are restructured: `/dashboard` becomes the home, the wizard moves to `/scripts/new` as a 3-step flow, and `/scripts/:id` is a new split-view detail page. Backend tightens the run-record shape, wires `saveRunLog` into the deploy + run paths, and exposes a new `GET /api/scripts/:id` returning deployment metadata + recent runs.

**Tech Stack:** React 19 + Vite + Tailwind + react-router v7 (frontend); Express + Firebase Admin + Secret Manager (backend). New deps: `lucide-react` for icons, `sonner` for toasts, `vitest` + `supertest` for the few tests that earn their keep.

**Spec:** `docs/superpowers/specs/2026-05-04-dashboard-design.md` — read first.

---

## Pragmatic notes for the implementer

- **No tests exist today.** Adding them universally would dwarf this work. We add unit tests only where they pay off: the new `GET /api/scripts/:id` route, the `saveRunLog` wiring, and the `relativeTime` helper. UI is verified manually in the browser.
- **Local dev only.** Don't redeploy to Cloud Run between tasks. The user runs both servers locally and validates in the browser. Deploy once at the end.
- **Each task ends with a commit.** Commits should leave the app in a working state — the user can run it after every task and click around.
- **Frequent visual checks.** Most tasks include a "Manual verification" step. Don't skip it; the cost of catching layout regressions early is much lower than at the end.

---

## File map (what gets created / modified / deleted)

### Frontend — created

| Path | Responsibility |
|------|----------------|
| `frontend/src/components/AppLayout.jsx` | Side-nav + main-content shell. Wraps every authenticated route. |
| `frontend/src/components/Sidenav.jsx` | Left rail: logo, workspace name, nav items, sign-out. |
| `frontend/src/components/ScriptRow.jsx` | Two-line equal-height row for the dashboard. |
| `frontend/src/components/Sparkline.jsx` | 7-bar tiny chart of recent run statuses. |
| `frontend/src/components/StatusDot.jsx` | 6px colored dot (green / red / gray). |
| `frontend/src/components/StatusBadge.jsx` | Rounded pill (OK / FAILED / MANUAL). |
| `frontend/src/components/MiniStepBar.jsx` | 3-step indicator for `/scripts/new`. |
| `frontend/src/components/RunRow.jsx` | Single row in the detail page's runs list. |
| `frontend/src/components/LogPane.jsx` | Dark monospace log viewer. |
| `frontend/src/pages/Dashboard.jsx` | `/dashboard` — list or empty welcome hero. |
| `frontend/src/pages/ScriptNew.jsx` | `/scripts/new` — wraps Configure → Deploy → Done. |
| `frontend/src/pages/ScriptDetail.jsx` | `/scripts/:id` — split view. |
| `frontend/src/pages/Activity.jsx` | Stub page. |
| `frontend/src/pages/Settings.jsx` | Stub page. |
| `frontend/src/lib/relativeTime.js` | `"3h ago"` formatter. |
| `frontend/src/lib/relativeTime.test.js` | Unit tests for the formatter. |

### Frontend — modified

| Path | Change |
|------|--------|
| `frontend/src/App.jsx` | New routes; wrap authenticated ones in `AppLayout`. |
| `frontend/src/main.jsx` | Mount `<Toaster />` from sonner. |
| `frontend/src/lib/api.js` | Add `getScript`, `runScript` (already exists, verify), `pauseScript`, `deleteScript`. |
| `frontend/src/pages/Login.jsx` | Redirect to `/dashboard` after success. |
| `frontend/src/pages/Configure.jsx` | Becomes a *step* inside `ScriptNew`, not a route. Remove `StepBar`. |
| `frontend/src/pages/Deploy.jsx` | Same. On success, navigate to `/scripts/:deploymentId` and toast. |
| `frontend/package.json` | Add `lucide-react`, `sonner`, `vitest`. |

### Frontend — deleted

| Path | Why |
|------|-----|
| `frontend/src/pages/Picker.jsx` | Folded into the dashboard's welcome hero + an inline chooser in `ScriptNew`. |
| `frontend/src/pages/Success.jsx` | Replaced by toast + redirect to `/scripts/:id`. |
| `frontend/src/components/StepBar.jsx` | Replaced by `MiniStepBar` (only used on `/scripts/new`). |

### Backend — modified

| Path | Change |
|------|--------|
| `backend/src/services/firestore.js` | Tighten `saveRunLog` shape: `{ runId, deploymentId, status, startedAt, durationMs, summary, logs, error? }`. Add `pausedAt` support on deployments. |
| `backend/src/routes/scripts.js` | Wire `saveRunLog` into `/deploy` and `/:id/run`. Add `GET /:id` returning `{ deployment, runs }`. Add `PATCH /:id` for pause/resume. Add `DELETE /:id`. |
| `backend/src/scripts/syncField.js` | Return a `{ logs, summary }` shape, not just `logs[]`. |
| `backend/src/scripts/countFeatures.js` | Same. |
| `backend/package.json` | Add `vitest`, `supertest`. |

### Backend — created

| Path | Responsibility |
|------|----------------|
| `backend/src/routes/scripts.test.js` | Tests for the new `GET /:id` and the `saveRunLog` wiring. |

---

## Task 1: Backend — tighten the run record shape

**Files:**
- Modify: `backend/src/services/firestore.js`
- Modify: `backend/src/scripts/syncField.js`
- Modify: `backend/src/scripts/countFeatures.js`

Today, scripts return `string[]`. We're moving to `{ logs: string[], summary: string }` so the dashboard can show a one-line "47 features synced" without parsing log lines. Run records also gain `runId`, `startedAt`, `durationMs`, `status`.

- [ ] **Step 1.1 — Update `countFeatures.js` to return a structured result**

In `backend/src/scripts/countFeatures.js`, change the function to return both logs and a summary:

```js
export async function runCountFeatures(pbClient, _config, workspaceId) {
  const logs = [];
  const log = (msg) => {
    console.log(`[countFeatures:${workspaceId}] ${msg}`);
    logs.push(msg);
  };

  log('Starting countFeatures…');

  let all = [];
  let cursor = null;
  let pages = 0;
  do {
    const res = await pbClient.getFeatures(cursor);
    all = all.concat(res.data || []);
    cursor = res.pageCursor || null;
    pages += 1;
    if (pages > 50) {
      log('Stopping after 50 pages (safety limit).');
      break;
    }
  } while (cursor);

  log(`Fetched ${all.length} feature(s) across ${pages} page(s).`);

  const byType = {};
  for (const f of all) {
    const t = f.type || 'unknown';
    byType[t] = (byType[t] || 0) + 1;
  }
  for (const [type, count] of Object.entries(byType)) {
    log(`  ${type}: ${count}`);
  }

  log('countFeatures complete ✓');

  return { logs, summary: `${all.length} features counted` };
}
```

- [ ] **Step 1.2 — Update `syncField.js` to return the same shape**

At the end of `runSyncField`, replace `return logs;` with:

```js
return { logs, summary: `${updated} features synced` };
```

(Where `updated` is the existing counter for features actually changed; if it doesn't exist, derive a reasonable summary from what the script tracked.)

- [ ] **Step 1.3 — Tighten `saveRunLog` in `firestore.js`**

Replace the existing `saveRunLog` with one that takes a structured run object and writes a stable shape:

```js
export async function saveRunLog(workspaceId, run) {
  const firestore = getDB();
  const doc = {
    runId: run.runId,
    deploymentId: run.deploymentId,
    status: run.status,             // 'ok' | 'fail'
    startedAt: run.startedAt,       // ISO string
    durationMs: run.durationMs,
    summary: run.summary,
    logs: run.logs,                 // string[]
    error: run.error || null,
  };
  if (!firestore) {
    const key = `${workspaceId}/logs/${run.deploymentId}/${run.runId}`;
    mockStore[key] = doc;
    return doc;
  }
  await firestore
    .collection(COLLECTION)
    .doc(workspaceId)
    .collection('logs')
    .doc(run.runId)
    .set(doc);
  return doc;
}
```

And update `getRunLogs(workspaceId, deploymentId)` to return `Run[]` sorted newest-first:

```js
export async function getRunLogs(workspaceId, deploymentId) {
  const firestore = getDB();
  if (!firestore) {
    return Object.entries(mockStore)
      .filter(([k]) => k.startsWith(`${workspaceId}/logs/${deploymentId}/`))
      .map(([, v]) => v)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }
  const snap = await firestore
    .collection(COLLECTION)
    .doc(workspaceId)
    .collection('logs')
    .where('deploymentId', '==', deploymentId)
    .orderBy('startedAt', 'desc')
    .get();
  return snap.docs.map((d) => d.data());
}
```

- [ ] **Step 1.4 — Manual verify the script returns the new shape**

Restart the backend (`npm run dev`). In the browser, deploy `countFeatures` end-to-end. Confirm the deploy response no longer crashes — it'll still show old success UI for now, that's fine.

- [ ] **Step 1.5 — Commit**

```bash
git add backend/src/services/firestore.js backend/src/scripts/
git commit -m "Tighten run record shape: structured result + stable Firestore doc"
```

---

## Task 2: Backend — wire saveRunLog into deploy + run, add GET /:id

**Files:**
- Modify: `backend/src/routes/scripts.js`
- Create: `backend/src/routes/scripts.test.js`
- Modify: `backend/package.json`

- [ ] **Step 2.1 — Install test deps**

```bash
cd backend
npm install --save-dev vitest supertest
```

Add to `backend/package.json` scripts:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 2.2 — Refactor the deploy route to record a run**

In `backend/src/routes/scripts.js`, replace the body of `router.post('/deploy', ...)` such that after running the script we build a structured run record and persist it via `saveRunLog`. Same for the `/:id/run` route.

Helper at the top of the file:

```js
import { v4 as uuidv4 } from 'uuid';
import { saveDeployment, getDeployments, getDeployment, saveRunLog, getRunLogs, deleteDeployment, patchDeployment } from '../services/firestore.js';

async function executeScript(scriptId, pbClient, config, workspaceId) {
  if (scriptId === 'syncField') return runSyncField(pbClient, config, workspaceId);
  if (scriptId === 'countFeatures') return runCountFeatures(pbClient, config, workspaceId);
  throw new Error(`No runner registered for scriptId="${scriptId}"`);
}

async function runAndPersist(deployment, pbClient, workspaceId) {
  const runId = uuidv4();
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  try {
    const { logs, summary } = await executeScript(
      deployment.scriptId, pbClient, deployment.config, workspaceId
    );
    const run = {
      runId, deploymentId: deployment.id, status: 'ok', startedAt,
      durationMs: Date.now() - t0, summary, logs,
    };
    await saveRunLog(workspaceId, run);
    return run;
  } catch (err) {
    const run = {
      runId, deploymentId: deployment.id, status: 'fail', startedAt,
      durationMs: Date.now() - t0, summary: err.message, logs: [`Error: ${err.message}`],
      error: err.message,
    };
    await saveRunLog(workspaceId, run);
    return run;
  }
}
```

The deploy route now:

```js
router.post('/deploy', requireAuth, async (req, res) => {
  const { scriptId, ...config } = req.body;
  const deploymentId = uuidv4();
  const workspaceId = req.workspace.workspaceId;

  const deployment = {
    id: deploymentId, scriptId, config, workspaceId,
    status: 'active',
    schedule: config.schedule || 'manual',
    createdAt: new Date().toISOString(),
  };
  await saveDeployment(workspaceId, deployment);

  const pbClient = createPBClient(await getToken(workspaceId));
  const run = await runAndPersist(deployment, pbClient, workspaceId);

  res.json({ deployment, run });
});
```

The `/:id/run` route similarly calls `runAndPersist`.

- [ ] **Step 2.3 — Add `getDeployment`, `patchDeployment`, `deleteDeployment` to firestore.js**

```js
export async function getDeployment(workspaceId, deploymentId) {
  const firestore = getDB();
  if (!firestore) {
    return mockStore[`${workspaceId}/deployments/${deploymentId}`] || null;
  }
  const snap = await firestore
    .collection(COLLECTION).doc(workspaceId)
    .collection('deployments').doc(deploymentId).get();
  return snap.exists ? snap.data() : null;
}

export async function patchDeployment(workspaceId, deploymentId, patch) {
  const firestore = getDB();
  if (!firestore) {
    const key = `${workspaceId}/deployments/${deploymentId}`;
    if (mockStore[key]) mockStore[key] = { ...mockStore[key], ...patch };
    return mockStore[key] || null;
  }
  await firestore.collection(COLLECTION).doc(workspaceId)
    .collection('deployments').doc(deploymentId).update(patch);
  return getDeployment(workspaceId, deploymentId);
}

export async function deleteDeployment(workspaceId, deploymentId) {
  const firestore = getDB();
  if (!firestore) {
    delete mockStore[`${workspaceId}/deployments/${deploymentId}`];
    return;
  }
  await firestore.collection(COLLECTION).doc(workspaceId)
    .collection('deployments').doc(deploymentId).delete();
}
```

- [ ] **Step 2.4 — Add `GET /:id`, `PATCH /:id`, `DELETE /:id` routes**

In `scripts.js`:

```js
// GET /scripts/:id — deployment + recent runs
router.get('/:id', requireAuth, async (req, res) => {
  const workspaceId = req.workspace.workspaceId;
  const deployment = await getDeployment(workspaceId, req.params.id);
  if (!deployment) return res.status(404).json({ message: 'Deployment not found' });
  const runs = await getRunLogs(workspaceId, req.params.id);
  res.json({ deployment, runs });
});

// PATCH /scripts/:id — pause/resume or update config
router.patch('/:id', requireAuth, async (req, res) => {
  const updated = await patchDeployment(
    req.workspace.workspaceId, req.params.id, req.body
  );
  if (!updated) return res.status(404).json({ message: 'Deployment not found' });
  res.json(updated);
});

// DELETE /scripts/:id
router.delete('/:id', requireAuth, async (req, res) => {
  await deleteDeployment(req.workspace.workspaceId, req.params.id);
  res.status(204).end();
});
```

- [ ] **Step 2.5 — Write tests for the new endpoints**

Create `backend/src/routes/scripts.test.js`:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import scriptsRoutes from './scripts.js';

// Stub the auth middleware by faking a JWT
const SECRET = 'test-secret';
process.env.JWT_SECRET = SECRET;

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
  it('returns 404 when deployment does not exist', async () => {
    const app = makeApp();
    const res = await request(app)
      .get('/scripts/does-not-exist')
      .set('Authorization', `Bearer ${makeToken()}`);
    expect(res.status).toBe(404);
  });

  // Note: a positive-path test requires injecting a fake deployment store.
  // Worth doing if firestore.js is refactored for DI; skip for now.
});

describe('DELETE /scripts/:id', () => {
  it('returns 401 without token', async () => {
    const app = makeApp();
    const res = await request(app).delete('/scripts/anything');
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2.6 — Run tests**

```bash
cd backend
npm test
```

Expected: all tests pass.

- [ ] **Step 2.7 — Manual verify with curl**

With backend running and a valid JWT (grab from browser localStorage):

```bash
JWT="paste-from-localStorage"
curl -s http://localhost:3000/api/scripts/does-not-exist \
  -H "Authorization: Bearer $JWT"
# expect: {"message":"Deployment not found"}
```

- [ ] **Step 2.8 — Commit**

```bash
git add backend/
git commit -m "Wire saveRunLog, add GET/PATCH/DELETE /scripts/:id"
```

---

## Task 3: Frontend — install icons + toast lib + add primitives

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/components/StatusDot.jsx`
- Create: `frontend/src/components/StatusBadge.jsx`
- Create: `frontend/src/components/Sparkline.jsx`
- Create: `frontend/src/lib/relativeTime.js`
- Create: `frontend/src/lib/relativeTime.test.js`
- Modify: `frontend/src/main.jsx`

- [ ] **Step 3.1 — Install deps**

```bash
cd frontend
npm install lucide-react sonner --legacy-peer-deps
npm install --save-dev vitest --legacy-peer-deps
```

Add to `frontend/package.json`:

```json
"test": "vitest run"
```

- [ ] **Step 3.2 — Mount `<Toaster />` in `main.jsx`**

```jsx
import { Toaster } from 'sonner';
// inside the render:
<>
  <App />
  <Toaster position="top-right" richColors />
</>
```

- [ ] **Step 3.3 — Create `StatusDot.jsx`**

```jsx
export default function StatusDot({ status, className = '' }) {
  const color = {
    ok: 'bg-emerald-500',
    fail: 'bg-red-500',
    paused: 'bg-gray-400',
    manual: 'bg-gray-400',
  }[status] || 'bg-gray-400';
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${color} ${className}`} />;
}
```

- [ ] **Step 3.4 — Create `StatusBadge.jsx`**

```jsx
import StatusDot from './StatusDot';

const styles = {
  ok: 'bg-emerald-50 text-emerald-700',
  fail: 'bg-red-50 text-red-700',
  manual: 'bg-gray-100 text-gray-600',
  paused: 'bg-gray-100 text-gray-600',
};

const labels = { ok: 'OK', fail: 'FAILED', manual: 'MANUAL', paused: 'PAUSED' };

export default function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${styles[status] || styles.manual}`}>
      <StatusDot status={status} />
      {labels[status] || 'UNKNOWN'}
    </span>
  );
}
```

- [ ] **Step 3.5 — Create `Sparkline.jsx`**

```jsx
export default function Sparkline({ runs = [], max = 7 }) {
  const recent = runs.slice(0, max).reverse();
  if (recent.length === 0) return <span className="text-xs text-gray-400">No runs yet</span>;
  return (
    <div className="flex items-end gap-0.5" style={{ height: 22 }}>
      {recent.map((r, i) => {
        const height = 40 + ((i * 13) % 50);
        const color = r.status === 'fail' ? 'bg-red-500' : 'bg-emerald-500';
        return <span key={r.runId || i} className={`${color} rounded-sm`} style={{ width: 4, height: `${height}%` }} />;
      })}
    </div>
  );
}
```

(Bar heights are deterministic from the index — purely visual, don't read meaning into them.)

- [ ] **Step 3.6 — Create `relativeTime.js` + tests**

`frontend/src/lib/relativeTime.js`:

```js
const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;

export function relativeTime(input, now = Date.now()) {
  const t = typeof input === 'string' ? Date.parse(input) : input;
  if (!Number.isFinite(t)) return '—';
  const diff = now - t;
  if (diff < 0) return 'just now';
  if (diff < MIN) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < HOUR) return `${Math.floor(diff / MIN)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  return `${Math.floor(diff / DAY)}d ago`;
}
```

`frontend/src/lib/relativeTime.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { relativeTime } from './relativeTime';

describe('relativeTime', () => {
  const now = Date.parse('2026-05-04T12:00:00Z');
  it('handles seconds', () => {
    expect(relativeTime(now - 5_000, now)).toBe('5s ago');
  });
  it('handles minutes', () => {
    expect(relativeTime(now - 5 * 60_000, now)).toBe('5m ago');
  });
  it('handles hours', () => {
    expect(relativeTime(now - 3 * 3_600_000, now)).toBe('3h ago');
  });
  it('handles days', () => {
    expect(relativeTime(now - 2 * 86_400_000, now)).toBe('2d ago');
  });
  it('returns dash for invalid input', () => {
    expect(relativeTime('garbage')).toBe('—');
  });
});
```

Run: `cd frontend && npm test` — expect green.

- [ ] **Step 3.7 — Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/
git commit -m "Add icons, toasts, and shared status/time primitives"
```

---

## Task 4: Frontend — AppLayout + Sidenav + new routes (with stubs)

**Files:**
- Create: `frontend/src/components/Sidenav.jsx`
- Create: `frontend/src/components/AppLayout.jsx`
- Create: `frontend/src/pages/Dashboard.jsx`
- Create: `frontend/src/pages/Activity.jsx`
- Create: `frontend/src/pages/Settings.jsx`
- Modify: `frontend/src/App.jsx`

- [ ] **Step 4.1 — Create `Sidenav.jsx`**

```jsx
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Boxes, Activity, Settings, LogOut } from 'lucide-react';
import { clearToken } from '../lib/auth';

const items = [
  { to: '/dashboard', label: 'Scripts', icon: Boxes, matches: (p) => p.startsWith('/dashboard') || p.startsWith('/scripts') },
  { to: '/activity', label: 'Activity', icon: Activity, matches: (p) => p.startsWith('/activity') },
  { to: '/settings', label: 'Settings', icon: Settings, matches: (p) => p.startsWith('/settings') },
];

export default function Sidenav({ workspaceLabel = 'Workspace' }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const handleLogout = () => {
    clearToken();
    navigate('/');
  };

  return (
    <aside className="flex w-44 flex-col border-r border-gray-200 bg-white">
      <div className="px-3 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-pb-blue" />
          <span className="text-sm font-bold text-pb-dark">PB Automate</span>
        </div>
        <div className="mt-1 truncate text-xs text-gray-500" title={workspaceLabel}>
          {workspaceLabel}
        </div>
      </div>

      <nav className="flex-1 px-2">
        {items.map(({ to, label, icon: Icon, matches }) => {
          const active = matches(pathname);
          return (
            <NavLink
              key={to}
              to={to}
              className={`mb-0.5 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${
                active ? 'bg-indigo-50 text-pb-blue' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Icon size={14} />
              {label}
            </NavLink>
          );
        })}
      </nav>

      <button
        onClick={handleLogout}
        className="m-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-gray-500 hover:bg-gray-50 hover:text-pb-dark"
      >
        <LogOut size={14} />
        Sign out
      </button>
    </aside>
  );
}
```

- [ ] **Step 4.2 — Create `AppLayout.jsx`**

```jsx
import { Navigate, Outlet } from 'react-router-dom';
import Sidenav from './Sidenav';
import { isAuthenticated } from '../lib/auth';

export default function AppLayout() {
  if (!isAuthenticated()) return <Navigate to="/" replace />;
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidenav workspaceLabel="My Workspace" />
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 4.3 — Stub `Dashboard.jsx`, `Activity.jsx`, `Settings.jsx`**

`Dashboard.jsx`:

```jsx
export default function Dashboard() {
  return <div className="text-gray-500">Dashboard goes here.</div>;
}
```

`Activity.jsx`:

```jsx
export default function Activity() {
  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-pb-dark">Activity</h1>
      <p className="text-sm text-gray-500">
        A unified feed of every script run across your workspace, with filters
        by script and status. Coming soon.
      </p>
    </div>
  );
}
```

`Settings.jsx`:

```jsx
export default function Settings() {
  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-pb-dark">Settings</h1>
      <p className="text-sm text-gray-500">
        Manage your Productboard token, workspace info, and account. Coming soon.
      </p>
    </div>
  );
}
```

- [ ] **Step 4.4 — Update `App.jsx` to use the new layout and routes**

```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import AppLayout from './components/AppLayout';
import Dashboard from './pages/Dashboard';
import Activity from './pages/Activity';
import Settings from './pages/Settings';
// Existing pages — temporarily routed at old paths until later tasks:
import Picker from './pages/Picker';
import Configure from './pages/Configure';
import Deploy from './pages/Deploy';
import Success from './pages/Success';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />

        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/activity" element={<Activity />} />
          <Route path="/settings" element={<Settings />} />

          {/* keep legacy routes alive during migration */}
          <Route path="/picker" element={<Picker />} />
          <Route path="/configure" element={<Configure />} />
          <Route path="/deploy" element={<Deploy />} />
          <Route path="/success" element={<Success />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 4.5 — Manual verify**

Run both servers. Sign in with API token. After login the URL should still go to `/picker` (we haven't changed that yet) but `/picker` should now render *with* the sidenav. Click Activity — see stub. Click Settings — see stub. Click Sign out — back to login.

- [ ] **Step 4.6 — Commit**

```bash
git add frontend/
git commit -m "Add AppLayout shell with sidenav + stub Activity/Settings/Dashboard"
```

---

## Task 5: Frontend — Dashboard list + welcome hero

**Files:**
- Modify: `frontend/src/lib/api.js`
- Create: `frontend/src/components/ScriptRow.jsx`
- Modify: `frontend/src/pages/Dashboard.jsx`
- Modify: `frontend/src/pages/Login.jsx` (redirect target)

- [ ] **Step 5.1 — Add API helpers**

In `frontend/src/lib/api.js`, add:

```js
export function getScript(id)        { return request(`/scripts/${id}`); }
export function pauseScript(id, paused) {
  return request(`/scripts/${id}`, { method: 'PATCH', body: JSON.stringify({ paused }) });
}
export function deleteScript(id)     { return request(`/scripts/${id}`, { method: 'DELETE' }).catch(() => ({})); }
```

(`runScript` already exists.)

- [ ] **Step 5.2 — Create `ScriptRow.jsx`**

```jsx
import { useNavigate } from 'react-router-dom';
import { Play, MoreHorizontal } from 'lucide-react';
import StatusDot from './StatusDot';
import StatusBadge from './StatusBadge';
import Sparkline from './Sparkline';
import { relativeTime } from '../lib/relativeTime';

export default function ScriptRow({ deployment, latestRun, recentRuns = [] }) {
  const navigate = useNavigate();
  const status = !latestRun ? 'manual' : latestRun.status;
  const scheduleLabel =
    deployment.schedule === 'manual' ? 'Manual trigger' :
    deployment.schedule === 'on-change' ? 'On webhook event' :
    `${deployment.schedule}`;
  const lastRunLine = !latestRun
    ? 'Never run'
    : latestRun.status === 'fail'
      ? `${relativeTime(latestRun.startedAt)} · ${latestRun.error || latestRun.summary}`
      : `${relativeTime(latestRun.startedAt)} · ${latestRun.summary}`;

  return (
    <div
      onClick={() => navigate(`/scripts/${deployment.id}`)}
      className="cursor-pointer border-b border-gray-100 p-4 last:border-b-0 hover:bg-gray-50"
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusDot status={status} />
          <span className="text-sm font-semibold text-pb-dark">{deployment.scriptId}</span>
          <StatusBadge status={status} />
        </div>
        <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50">
            <Play size={12} className="mr-1 inline" /> Run
          </button>
          <button className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50">
            <MoreHorizontal size={12} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Field label="Schedule" value={scheduleLabel} />
        <Field
          label="Last run"
          value={lastRunLine}
          valueClass={latestRun?.status === 'fail' ? 'text-red-700' : ''}
        />
        <div>
          <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            Last 7 runs
          </div>
          <Sparkline runs={recentRuns} />
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, valueClass = '' }) {
  return (
    <div>
      <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</div>
      <div className={`text-xs font-medium text-pb-dark ${valueClass}`}>{value}</div>
    </div>
  );
}
```

- [ ] **Step 5.3 — Implement `Dashboard.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Zap } from 'lucide-react';
import { getScripts } from '../lib/api';
import ScriptRow from '../components/ScriptRow';

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState({ scripts: [], deployments: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Capture token from /scripts/new redirect-back URL if present.
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('token');
    if (tokenFromUrl) {
      localStorage.setItem('pb_token', tokenFromUrl);
      window.history.replaceState({}, '', '/dashboard');
    }
    getScripts().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-sm text-gray-500">Loading…</div>;

  const deployments = data.deployments || [];

  if (deployments.length === 0) {
    return (
      <div className="mx-auto max-w-md rounded-2xl bg-white p-10 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-pb-blue">
          <Zap size={26} />
        </div>
        <h1 className="mb-1 text-lg font-bold text-pb-dark">Welcome to PB Automate</h1>
        <p className="mb-5 text-sm text-gray-500">
          Deploy automation scripts to your Productboard workspace — no code required.
        </p>
        <button
          onClick={() => navigate('/scripts/new')}
          className="rounded-lg bg-pb-blue px-4 py-2 text-sm font-semibold text-white hover:bg-pb-blue/90"
        >
          + Deploy your first script
        </button>
        <div className="mt-4 text-[11px] text-gray-400">
          ✓ Sync custom fields · ✓ Roll up scores · ✓ Propagate tags
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-pb-dark">Your Scripts</h1>
          <p className="text-xs text-gray-500">{deployments.length} active</p>
        </div>
        <button
          onClick={() => navigate('/scripts/new')}
          className="inline-flex items-center gap-1 rounded-lg bg-pb-blue px-3 py-1.5 text-xs font-semibold text-white hover:bg-pb-blue/90"
        >
          <Plus size={14} /> Add Script
        </button>
      </div>

      <div className="rounded-2xl bg-white shadow-sm">
        {deployments.map((d) => (
          <ScriptRow
            key={d.id}
            deployment={d}
            latestRun={d.latestRun}
            recentRuns={d.recentRuns || []}
          />
        ))}
      </div>
    </>
  );
}
```

> **Note:** the existing `GET /scripts` returns only `{ scripts, deployments }` without `latestRun` / `recentRuns`. For now the dashboard shows whatever's there and the row falls back to "Never run". A follow-up enhancement (Task 8) extends `GET /scripts` to include the most recent run per deployment.

- [ ] **Step 5.4 — Update `Login.jsx` to redirect to `/dashboard`**

Replace `navigate('/picker')` with `navigate('/dashboard')` after a successful API token login. (If your login uses OAuth, the backend redirects to `/picker?token=…` — that'll be fixed in Task 6.)

- [ ] **Step 5.5 — Manual verify**

Sign in with API token. Land on `/dashboard`. With zero deployments → welcome hero. Click "Deploy your first script" → navigates to `/scripts/new` (404 for now, fine — Task 6 builds it).

- [ ] **Step 5.6 — Commit**

```bash
git add frontend/
git commit -m "Build dashboard list view + welcome hero empty state"
```

---

## Task 6: Frontend — `/scripts/new` wizard (3 steps), retire Picker/Success

**Files:**
- Create: `frontend/src/components/MiniStepBar.jsx`
- Create: `frontend/src/pages/ScriptNew.jsx`
- Modify: `frontend/src/pages/Configure.jsx` (becomes pure component, no `StepBar`)
- Modify: `frontend/src/pages/Deploy.jsx` (becomes pure component; success goes to `/scripts/:id`)
- Modify: `frontend/src/App.jsx` (add `/scripts/new`, remove `/picker`, `/configure`, `/deploy`, `/success`)
- Delete: `frontend/src/pages/Picker.jsx`, `frontend/src/pages/Success.jsx`, `frontend/src/components/StepBar.jsx`
- Modify: `backend/src/routes/auth.js` (OAuth redirect → `/dashboard?token=...`)

- [ ] **Step 6.1 — `MiniStepBar.jsx`**

```jsx
const steps = ['Configure', 'Deploy', 'Done'];
export default function MiniStepBar({ current }) {
  return (
    <div className="mb-6 flex items-center justify-center gap-2">
      {steps.map((label, i) => {
        const n = i + 1, active = n === current, done = n < current;
        return (
          <div key={label} className="flex items-center gap-1.5">
            {i > 0 && <div className={`h-px w-8 ${done ? 'bg-pb-blue' : 'bg-gray-300'}`} />}
            <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
              active ? 'bg-pb-blue text-white'
              : done ? 'bg-pb-blue/20 text-pb-blue'
              : 'bg-gray-200 text-gray-500'}`}>
              {done ? '✓' : n}
            </div>
            <span className={`text-xs font-medium ${active ? 'text-pb-dark' : 'text-gray-400'}`}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 6.2 — Refactor `Configure.jsx` to a controlled component**

Strip the page chrome, accept props:

```jsx
export default function Configure({ scriptId, onContinue }) {
  // existing form state, but call onContinue({ scriptId, config }) instead of navigate
  // remove StepBar import + render
  // remove the outer mx-auto/max-w/StepBar wrappers
}
```

Same treatment for `Deploy.jsx`:

```jsx
export default function Deploy({ scriptId, config, onSuccess }) {
  // on successful deploy: onSuccess(result)
}
```

- [ ] **Step 6.3 — Build `ScriptNew.jsx`**

```jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import MiniStepBar from '../components/MiniStepBar';
import Configure from './Configure';
import Deploy from './Deploy';

const SCRIPTS = [
  { id: 'countFeatures', label: 'Count Features (Smoke Test)' },
  { id: 'syncField', label: 'Sync Custom Field' },
];

export default function ScriptNew() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [scriptId, setScriptId] = useState('countFeatures');
  const [config, setConfig] = useState(null);

  return (
    <div className="mx-auto max-w-2xl">
      <MiniStepBar current={step} />

      {step === 1 && (
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium text-gray-500">Script</label>
            <div className="flex gap-2">
              {SCRIPTS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setScriptId(s.id)}
                  className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                    scriptId === s.id
                      ? 'border-pb-blue bg-indigo-50 text-pb-blue'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <Configure
            scriptId={scriptId}
            onContinue={(c) => { setConfig(c.config); setStep(2); }}
          />
        </div>
      )}

      {step === 2 && config && (
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <Deploy
            scriptId={scriptId}
            config={config}
            onSuccess={(result) => {
              toast.success('Script deployed');
              navigate(`/scripts/${result.deployment.id}`);
            }}
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6.4 — Wire `/scripts/new` route in `App.jsx`**

Add inside `<Route element={<AppLayout />}>`:

```jsx
<Route path="/scripts/new" element={<ScriptNew />} />
```

Remove the legacy `/picker`, `/configure`, `/deploy`, `/success` routes. Delete the corresponding files.

- [ ] **Step 6.5 — Update OAuth redirect in `backend/src/routes/auth.js`**

Find the line that redirects after OAuth callback to `/picker?token=...` and change to `/dashboard?token=...`. (The dashboard already captures the token from query string in Task 5.)

- [ ] **Step 6.6 — Manual verify**

Sign in. From the welcome hero, click "Deploy your first script" → land on `/scripts/new` step 1. Walk through Configure → Deploy. After clicking Deploy, see a toast and land on `/scripts/:id` (which 404s for now — Task 7 builds it).

- [ ] **Step 6.7 — Commit**

```bash
git add -A
git commit -m "Build /scripts/new wizard, retire Picker and Success pages"
```

---

## Task 7: Frontend — Detail page (`/scripts/:id`) split view

**Files:**
- Create: `frontend/src/components/RunRow.jsx`
- Create: `frontend/src/components/LogPane.jsx`
- Create: `frontend/src/pages/ScriptDetail.jsx`
- Modify: `frontend/src/App.jsx` (add route)

- [ ] **Step 7.1 — `RunRow.jsx`**

```jsx
import StatusDot from './StatusDot';
import StatusBadge from './StatusBadge';
import { relativeTime } from '../lib/relativeTime';

export default function RunRow({ run, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`grid w-full grid-cols-[12px_1fr_auto_auto] items-center gap-2 border-b border-gray-100 px-3 py-2 text-left text-[11px] last:border-b-0 ${
        selected ? 'bg-indigo-50' : 'hover:bg-gray-50'
      }`}
    >
      <StatusDot status={run.status} />
      <div className="overflow-hidden">
        <div className="truncate font-medium text-pb-dark">{relativeTime(run.startedAt)}</div>
        <div className={`truncate ${run.status === 'fail' ? 'text-red-700' : 'text-gray-500'}`}>
          {run.summary}
        </div>
      </div>
      <StatusBadge status={run.status} />
      <span className="text-[10px] text-gray-400">{(run.durationMs / 1000).toFixed(1)}s</span>
    </button>
  );
}
```

- [ ] **Step 7.2 — `LogPane.jsx`**

```jsx
export default function LogPane({ logs = [] }) {
  if (!logs.length) return <div className="text-xs text-gray-400">No log lines.</div>;
  return (
    <pre className="max-h-full overflow-auto rounded-md bg-pb-dark p-3 font-mono text-[10px] leading-relaxed text-emerald-400">
      {logs.map((l, i) => {
        const isErr = /error|fail|exception/i.test(l);
        return <div key={i} className={isErr ? 'text-red-400' : ''}>{l}</div>;
      })}
    </pre>
  );
}
```

- [ ] **Step 7.3 — `ScriptDetail.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Play, MoreHorizontal, Edit3 } from 'lucide-react';
import { toast } from 'sonner';
import { getScript, runScript } from '../lib/api';
import StatusDot from '../components/StatusDot';
import StatusBadge from '../components/StatusBadge';
import RunRow from '../components/RunRow';
import LogPane from '../components/LogPane';
import { relativeTime } from '../lib/relativeTime';

export default function ScriptDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [running, setRunning] = useState(false);

  const load = () => getScript(id).then((d) => {
    setData(d);
    setSelectedId(d.runs?.[0]?.runId || null);
  }).catch((e) => setError(e.message));

  useEffect(() => { load(); }, [id]);

  if (error) return <div className="text-sm text-red-600">{error}</div>;
  if (!data) return <div className="text-sm text-gray-500">Loading…</div>;

  const { deployment, runs } = data;
  const selected = runs.find((r) => r.runId === selectedId) || runs[0];
  const status = !selected ? 'manual' : selected.status;

  const handleRun = async () => {
    setRunning(true);
    try {
      await runScript(id);
      toast.success('Run complete');
      await load();
    } catch (e) {
      toast.error(`Run failed: ${e.message}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="mb-2 text-xs text-gray-500">
        <Link to="/dashboard" className="hover:text-pb-dark">Scripts</Link>
        <span className="px-1">›</span>
        <span>{deployment.scriptId}</span>
      </div>

      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="mb-0.5 flex items-center gap-2">
            <StatusDot status={status} />
            <h1 className="text-base font-bold text-pb-dark">{deployment.scriptId}</h1>
            <StatusBadge status={status} />
          </div>
          <div className="text-xs text-gray-500">
            {deployment.schedule}
            {selected && ` · last ran ${relativeTime(selected.startedAt)}`}
          </div>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={handleRun}
            disabled={running}
            className="inline-flex items-center gap-1 rounded-md bg-pb-blue px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-pb-blue/90 disabled:opacity-50"
          >
            <Play size={12} /> {running ? 'Running…' : 'Run'}
          </button>
          <button className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
            <Edit3 size={12} /> Edit
          </button>
          <button className="rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
            <MoreHorizontal size={12} />
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-3">
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="border-b border-gray-100 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            Runs ({runs.length})
          </div>
          <div className="overflow-auto" style={{ maxHeight: 'calc(100% - 40px)' }}>
            {runs.length === 0
              ? <div className="p-3 text-xs text-gray-400">No runs yet.</div>
              : runs.map((r) => (
                <RunRow key={r.runId} run={r} selected={r.runId === selectedId} onClick={() => setSelectedId(r.runId)} />
              ))}
          </div>
        </div>

        <div className="flex flex-col rounded-2xl bg-white p-3 shadow-sm">
          {selected ? (
            <>
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusDot status={selected.status} />
                  <span className="text-sm font-semibold text-pb-dark">
                    Run · {relativeTime(selected.startedAt)}
                  </span>
                  <StatusBadge status={selected.status} />
                </div>
                <span className="text-[10px] text-gray-400">
                  {(selected.durationMs / 1000).toFixed(1)}s
                </span>
              </div>
              <div className="min-h-0 flex-1">
                <LogPane logs={selected.logs} />
              </div>
            </>
          ) : (
            <div className="text-sm text-gray-400">Nothing to read yet — click Run to trigger one.</div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 7.4 — Add route in `App.jsx`**

```jsx
<Route path="/scripts/:id" element={<ScriptDetail />} />
```

- [ ] **Step 7.5 — Manual verify**

Deploy a `countFeatures`. After redirect, you should land on `/scripts/:id` showing one run on the left, log pane on the right. Click Run again — second run appears and selecting it loads its logs.

- [ ] **Step 7.6 — Commit**

```bash
git add frontend/
git commit -m "Build /scripts/:id detail page with split runs/logs view"
```

---

## Task 8: Backend — extend `GET /scripts` to include latestRun + recentRuns

**Files:**
- Modify: `backend/src/routes/scripts.js`

The dashboard's `ScriptRow` expects `deployment.latestRun` and `deployment.recentRuns`. Without this, every row says "Never run". Quick patch.

- [ ] **Step 8.1 — Update the list route**

```js
router.get('/', requireAuth, async (req, res) => {
  const workspaceId = req.workspace.workspaceId;
  const deployments = await getDeployments(workspaceId);

  const enriched = await Promise.all(
    deployments.map(async (d) => {
      const runs = await getRunLogs(workspaceId, d.id);
      return { ...d, latestRun: runs[0] || null, recentRuns: runs.slice(0, 7) };
    })
  );

  const scripts = AVAILABLE_SCRIPTS.map((s) => ({
    ...s,
    deployed: enriched.some((d) => d.scriptId === s.id),
  }));
  res.json({ scripts, deployments: enriched });
});
```

- [ ] **Step 8.2 — Manual verify**

Refresh `/dashboard`. Sparklines + last-run lines should populate.

- [ ] **Step 8.3 — Commit**

```bash
git add backend/
git commit -m "Include latestRun + recentRuns in GET /scripts response"
```

---

## Task 9: Wire dashboard row actions (Run / Pause / Delete)

**Files:**
- Modify: `frontend/src/components/ScriptRow.jsx`

- [ ] **Step 9.1 — Wire Run button**

```jsx
import { runScript } from '../lib/api';
import { toast } from 'sonner';
// inside the component:
const [running, setRunning] = useState(false);
const handleRun = async (e) => {
  e.stopPropagation();
  setRunning(true);
  try {
    await runScript(deployment.id);
    toast.success(`${deployment.scriptId} ran successfully`);
    onChanged?.();
  } catch (err) {
    toast.error(err.message);
  } finally { setRunning(false); }
};
```

(Pass `onChanged={loadData}` from `Dashboard.jsx`. Re-fetch after a run so the sparkline updates.)

- [ ] **Step 9.2 — Add a kebab menu (small popover) with Pause + Delete**

Use a tiny conditional `<div>` triggered by local state. Don't reach for a popover library yet.

```jsx
const [menuOpen, setMenuOpen] = useState(false);
// click opens menu; clicking Pause calls pauseScript, Delete calls deleteScript with confirm()
```

- [ ] **Step 9.3 — Manual verify**

Click Run on a row → toast appears, sparkline updates within a second. Pause → status badge flips. Delete (after `confirm()`) → row disappears.

- [ ] **Step 9.4 — Commit**

```bash
git add frontend/
git commit -m "Wire dashboard row actions: Run, Pause, Delete"
```

---

## Task 10: Visual polish + cleanup

**Files:**
- Modify: anywhere `text-gray-400` is used for body text → bump to `text-gray-500` or `text-gray-600`
- Modify: anywhere `bg-pb-blue` button styles repeat → keep using the inline classes (no design-system extraction yet)
- Audit: any leftover emojis (`✅ 🔄 📊 🏷 ⚙️ ⚡`) — replace with `lucide-react` glyphs

- [ ] **Step 10.1 — Run a contrast sweep**

```bash
grep -rn "text-gray-400" frontend/src
```

For each match that's body or value text (not a divider/icon), bump one shade darker. Skip cases where the gray-400 is a deliberate de-emphasis on hover-only states.

- [ ] **Step 10.2 — Replace lingering emojis**

Likely candidates:
- `frontend/src/pages/Login.jsx` — review icon usage
- Any `Configure.jsx` icons

Use Lucide equivalents: ✅ → `<Check />`, 🔄 → `<RefreshCw />`, 📊 → `<BarChart3 />`, 🏷 → `<Tag />`, ⚙️ → `<Settings />`, ⚡ → `<Zap />`.

- [ ] **Step 10.3 — Manual full walk-through**

Sign out, sign in fresh, walk through: empty dashboard → wizard → live detail page → run → run again → back to dashboard → click row again. Look for visual jank.

- [ ] **Step 10.4 — Commit**

```bash
git add frontend/
git commit -m "Visual polish: contrast bumps + lucide replacements"
```

---

## Task 11: Deploy to Cloud Run

**Files:**
- None (deployment-only)

The whole redesign should be tested locally before redeploying. Once the local walk-through is clean:

- [ ] **Step 11.1 — Push everything**

```bash
git push
```

- [ ] **Step 11.2 — In Cloud Shell, pull + deploy**

```bash
cd ~/pb-automate
git pull
gcloud run deploy pb-automate-backend --source . --region us-central1 --allow-unauthenticated
```

- [ ] **Step 11.3 — Smoke-test in production**

Visit the Cloud Run URL. OAuth round-trip → land on `/dashboard`. Deploy a new `countFeatures` → land on `/scripts/:id` with a real run. Sign out works.

If anything breaks in prod that didn't break locally, the most likely cause is environment-variable drift — confirm `GCP_PROJECT_ID` is still set on the Cloud Run service (it's commented out locally on purpose).

---

## Open questions to resolve in execution

These were flagged in the spec; defer the decision to the implementer:

1. **Choose-script chooser on `/scripts/new`** — pill row (used in plan above) is fine for v1; revisit if more than ~4 scripts ever ship.
2. **Optimistic vs pessimistic Run** — plan uses pessimistic (await the response, then refetch). Optimistic UI can come later.
3. **Workspace label** — hardcoded `"My Workspace"` in `AppLayout` for now. A follow-up task fetches the real PB workspace name once we add a `GET /api/me` endpoint.

## Success criteria

- Sign-in lands on `/dashboard` (not `/picker`).
- Empty workspace shows the welcome hero with one CTA.
- Deploying a script lands on `/scripts/:id` with the first run already present.
- Clicking a dashboard row navigates to its detail page.
- Running a script from any surface persists a run record visible on the detail page within 2 seconds.
- Sign out works from the sidenav.
- All `vitest` tests pass.
- No console errors in the browser during a full walk-through.
