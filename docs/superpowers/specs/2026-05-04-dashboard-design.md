# PB Automate — Dashboard Design

**Date:** 2026-05-04
**Status:** Design — pending implementation

## Context

PB Automate is a wizard-only app today. After OAuth (or API token) login, users walk through Connect → Choose Script → Configure → Deploy → Done, then have nowhere to go. "Back to Home" on the success screen routes to `/`, which is the Login page, so it effectively signs the user out. There is no place to:

- See the scripts a customer has already deployed.
- Check whether a script ran successfully.
- Read logs for a past run (logs are shown once on the success screen and lost).
- Re-run, pause, edit, or delete a deployed script.

This spec defines a **dashboard-anchored** information architecture that makes monitoring deployed scripts the primary experience, with the wizard becoming a sub-flow launched from the dashboard.

## Goals

1. Give users a home view that lists their deployed scripts with at-a-glance status.
2. Make it easy to drill into any past run and read its logs.
3. Preserve the existing wizard for adding new scripts, but reduce it from five steps to three by folding the script-picker into the dashboard's empty state.
4. Lay groundwork for future surfaces (Activity, Settings) without building them now.

## Non-goals

- A full Activity feed across all scripts. Stub the route, defer the feature.
- Settings (token rotation, workspace info, account deletion). Stub the route, defer.
- Custom-script upload. Out of scope.
- Webhook receiver UI / on-change scheduling UI. Out of scope.
- Mobile-optimized layouts. Desktop only for v1.

## Primary user job

> "I deployed a script. Did it run? Did it work? If not, why?"

Most user time on the app, post-onboarding, is spent monitoring. Adding scripts is occasional. Editing/pausing is rarer still. The design optimizes for the monitoring case.

## Information architecture

All authenticated routes share a side-nav chrome. `/login` has no chrome.

| Route             | Purpose                                                       | Built in v1? |
|-------------------|---------------------------------------------------------------|--------------|
| `/login`          | Sign-in (OAuth + API token)                                   | yes (exists) |
| `/dashboard`      | List of deployed scripts (the new home)                       | yes          |
| `/scripts/new`    | Wizard — Configure → Deploy → Done                            | yes (rework) |
| `/scripts/:id`    | Detail page — runs list + selected-run logs                   | yes          |
| `/activity`       | Global feed of all runs across all scripts                    | stub only    |
| `/settings`       | Workspace + token management                                  | stub only    |

The default landing page after login becomes `/dashboard` (currently `/picker`).

## Chrome — side nav

A persistent left sidebar, ~140px wide, on every authenticated route.

**Top:**
- "PB Automate" wordmark + small purple square logo mark.
- Workspace name beneath the logo (so multi-workspace customers know where they are). Source: derived from the session — for OAuth, from the PB callback; for API-token sessions, the deterministic `pat-<hash>` ID is fine for v1 (we can fetch the real workspace name later via `/workspaces` once available).

**Middle (nav items):**
- **Scripts** — links to `/dashboard` (active when route matches `/dashboard`, `/scripts/new`, or `/scripts/:id`).
- **Activity** — links to `/activity` (stub).
- **Settings** — links to `/settings` (stub).

**Bottom:**
- User avatar (initial of workspace name) + "Sign out" link.
- Clicking Sign out: clears the JWT from localStorage and redirects to `/login`.

The current `StepBar` component is removed from all pages **except** `/scripts/new`, where it's replaced with a simpler 3-step indicator (Configure / Deploy / Done) at the top of the page.

## Dashboard (`/dashboard`)

### Page-level layout

- Page header (top of main content area):
  - Left: "Your Scripts (N)" with an "N active" subtitle when N > 0.
  - Right: `+ Add Script` button (primary) — links to `/scripts/new`.
- Body: either the populated list or the empty-state hero, based on `deployments.length`.

### Empty state — `deployments.length === 0`

A centered welcome card on the gray canvas. No "+ Add Script" button in the page header in this state (the empty card has the only CTA, to focus attention).

- Centered round icon (purple, ~56px) — placeholder lightning glyph.
- H1: "Welcome to PB Automate"
- Sub: "Deploy automation scripts to your Productboard workspace — no code required."
- Primary CTA: `+ Deploy your first script` → `/scripts/new`.
- Subtle footer line listing capabilities: "✓ Sync custom fields · ✓ Roll up scores · ✓ Propagate tags"

### Populated state — `deployments.length >= 1`

A single white card holding equal-height row entries, one per deployed script. Rows are vertically stacked, separated by a 1px gray hairline.

**Each row (two-line layout):**

- **Top line, flex row, space-between:**
  - Left: status dot · script name (semibold, 14px) · status badge (`OK` / `FAILED` / `MANUAL`).
  - Right: `▶ Run` button + `⋯` kebab. Kebab menu items: Pause/Resume, Delete.
- **Bottom line, three labelled fields in a 1fr/1fr/1fr grid:**
  - **Schedule** — uppercase tiny label + "Daily · next in 21h" (or "Manual trigger" for manual scripts).
  - **Last run** — uppercase tiny label + "3h ago · 47 features synced" (relative time + a one-line summary, in red text if the last run failed).
  - **Last 7 runs** — uppercase tiny label + a tiny vertical-bar sparkline (7 bars max). Green bars for success, red for failure. Heights vary slightly so the chart has visual texture even when all-green.

Clicking anywhere on the row (except the action buttons) navigates to `/scripts/:id`.

### Visual specifics

- Status dot: 6px round, green/red/gray.
- Status badge: rounded-pill, small text, light-tint background (`bg-emerald-50` / `bg-red-50` / `bg-gray-100`) with matching saturated text.
- Sparkline: 7 vertical bars, 4px wide, 2px gap, ~22px tall, colored per outcome.

## Add-script wizard (`/scripts/new`)

### Restructured to three steps

The current 5-step wizard collapses:

| Old step      | New behavior                                                     |
|---------------|------------------------------------------------------------------|
| Connect       | Removed (handled by `/login`).                                   |
| Choose Script | Folded into the dashboard's welcome hero + an in-flow chooser.   |
| Configure     | Step 1.                                                          |
| Deploy        | Step 2.                                                          |
| Done          | Step 3 — flashes a confirmation, redirects to `/scripts/:id`.    |

A small "Choose script" chooser still exists at the top of `/scripts/new` for users coming in via the `+ Add Script` button (since the dashboard already had at least one script and skipped the welcome hero). It can be a simple dropdown or a horizontal pill selector. **Decision needed in the implementation plan**, not here — both are acceptable.

### Step indicator

At the top of `/scripts/new`, a 3-step indicator: Configure / Deploy / Done. Same component family as today's `StepBar` but lighter-weight.

### Post-deploy behavior

After successful deploy, the backend response includes `deploymentId`. The frontend redirects to `/scripts/:deploymentId` and shows a brief "Script deployed" toast for ~3 seconds. The user lands on the live detail page seeing their first run.

## Detail page (`/scripts/:id`) — split view

### Header strip (full width, above split)

- Breadcrumb: `Scripts › <script name>` (clicking "Scripts" returns to `/dashboard`).
- Title row: status dot · script name (h1, 16-18px) · status badge.
- Meta line: "Hourly · Children → Parent · last ran 12m ago" — schedule, brief config summary, last-run relative time.
- Right side actions: `▶ Run` (primary), `Edit` (secondary), `⋯` (menu — Pause/Resume, Delete).

### Body — split into two columns, fills remaining viewport

- **Left pane (~45% width):** Runs list, scrollable.
  - Header: "Runs (N)" small label + a future filter dropdown ("All ▾").
  - Each row: status dot · timestamp + one-line summary · status badge · duration. Single line, ~36px tall.
  - Clicking a row selects it (highlight bg purple-50, no navigation).
  - Default selection: the most recent run.
- **Right pane (~55% width):** Selected run details.
  - Header: status dot · "Run · 12m ago" · status badge · "Copy" link (right) for copying the full log to clipboard. Sub-line: "Started 10:42:12 · ran for 0.3s".
  - Body: dark log pane, monospace, syntax-highlighted (timestamp gray, normal lines green, errors red).

### Where configuration lives

- **Not visible** by default — accessed via the `Edit` button in the header.
- Edit opens a modal (or slide-over) with the same form fields as the wizard's Configure step, plus a "Save" button. Saving updates the deployment in Firestore. No re-run on save (user can click "Run" separately if they want).
- Rationale: users look at config only when they're going to change it. Showing it always (as a third panel) clutters the diagnostic flow.

### Empty / loading states

- **Loading:** skeleton rows in the runs list, empty log pane.
- **No runs yet** (just deployed, scheduled run hasn't fired): runs list shows "No runs yet — schedule will fire <relative time>" and the right pane shows a friendly "Nothing to read yet" placeholder. The user can click `▶ Run` to trigger one.

## Activity (`/activity`) — stub

Routes exists, sidenav highlights it when active. Page renders a placeholder:

- Heading "Activity"
- Sub: "A unified feed of every script run across your workspace, with filters by script and status. Coming soon."
- No data fetching, no API calls.

## Settings (`/settings`) — stub

Same treatment as Activity:

- Heading "Settings"
- Sub: "Manage your Productboard token, workspace info, and account. Coming soon."

## Visual system

To support this design without slipping into emoji-driven AI aesthetic, the implementation plan should also:

1. Replace all emoji icons (✅ 🔄 📊 🏷 ⚙️ ⚡) with `lucide-react` (or equivalent) — outlined glyphs at consistent stroke weight.
2. Define three button tiers in Tailwind: `btn-primary` (filled purple), `btn-secondary` (white with border), `btn-ghost` (text only). Use only one `btn-primary` per screen.
3. Bump every `text-gray-400` text color to `text-gray-500` or `text-gray-600` to clear WCAG AA on white backgrounds.
4. Standardize on a fixed sparkline component for reuse on dashboard rows and (later) detail-page mini charts.

These are visual polish items the code reviewer should expect to see called out in the implementation plan.

## Backend impact

Most existing endpoints already support what the dashboard needs, but two enhancements:

1. **`saveRunLog` must actually be called** after every run. Currently it's defined in `firestore.js` but unused. The deploy route's first-run logs and the manual-run logs both need to persist via `saveRunLog`. The detail page reads them via `getRunLogs`.
2. **`GET /api/scripts/:id`** new endpoint: returns the deployment's metadata + recent runs. Currently `GET /api/scripts/:id/logs` returns logs only. We can either:
   - Extend `/logs` to return both the deployment and its runs, or
   - Add a new `GET /api/scripts/:id` that returns deployment + runs in one shape.
   - **Recommendation:** the latter — cleaner separation, easier to evolve.
3. **Run record shape** — Firestore `logs` subcollection should store one document per run, with `{ runId, deploymentId, status, startedAt, durationMs, summary, logs: [string], error?: string }`. Today the shape is loose; tighten it.

No changes to the auth, secret, or scheduler services.

## Out of scope (tracked for follow-up)

- Activity feed implementation
- Settings page implementation
- Edit-config modal (deferred — for v1 the Edit button can navigate to a small `/scripts/:id/edit` route that reuses the wizard's Configure step; modal can come later)
- Pause/Resume functionality (kebab menu wires to a backend `PATCH /api/scripts/:id` to flip a `paused` flag; the scheduler skips paused deployments)
- Sparkline data: needs at least 7 prior runs; for new scripts, render fewer bars (no padding placeholders)
- Workspace name resolution for OAuth sessions (currently `pat-<hash>` shows up; ideally show the real PB workspace name)

## Open questions for implementation plan

- **Choose-script chooser on `/scripts/new`** — pill selector vs. dropdown vs. card grid (since the user has scripts already, a horizontal pill bar feels lightest)?
- **Run-now from the dashboard row** — should it be optimistic (immediately update UI, append a run row) or pessimistic (wait for response)? Latter is simpler.
- **Toast component** — none exists today; pick a lib (`sonner`, `react-hot-toast`) or roll a 30-line one?
- **Sidenav active-state matching** — exact matching is brittle (`/scripts/:id` isn't `/dashboard`). Use a route-based predicate: Scripts is active for `/dashboard`, `/scripts/*`.
