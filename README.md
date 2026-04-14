# PB Automate

A full-stack platform that lets Productboard customers deploy field-sync automation scripts without engineering help.

## Architecture

- **Frontend**: React + Vite, Tailwind CSS
- **Backend**: Node.js (Express), deployed to GCP Cloud Run
- **Auth**: Productboard OAuth 2.0 (authorization code flow)
- **Database**: Firestore (customer configs + script definitions)
- **Secrets**: GCP Secret Manager (per-tenant PB access tokens)
- **Scheduler**: GCP Cloud Scheduler (cron triggers for scripts)
- **IaC**: Terraform for all GCP resources

## Project Structure

```
pb-automate/
├── frontend/          React + Vite app
│   └── src/
│       ├── pages/     Login, Picker, Configure, Deploy, Success
│       ├── components/ ScriptCard, FieldMapper, StepBar, SchedulePicker
│       └── lib/       api.js, auth.js
├── backend/           Express API server
│   └── src/
│       ├── routes/    auth.js, scripts.js, webhooks.js
│       ├── services/  pbClient.js, firestore.js, secretManager.js
│       ├── scripts/   syncField.js, rollupScore.js, propagateTags.js
│       └── index.js
├── infra/             Terraform (Cloud Run, Firestore, Scheduler, Secret Manager)
└── README.md
```

## Local Development Setup

### Prerequisites

- Node.js 18+
- npm

### 1. Clone and install

```bash
cd pb-automate

# Backend
cd backend
cp .env.example .env
# Edit .env with your values (or leave defaults for mock mode)
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Configure environment

Edit `backend/.env`:

```env
PB_CLIENT_ID=your_productboard_client_id
PB_CLIENT_SECRET=your_productboard_client_secret
PB_REDIRECT_URI=http://localhost:3000/auth/callback
GCP_PROJECT_ID=your_gcp_project_id
JWT_SECRET=your_jwt_secret_change_me
FIRESTORE_COLLECTION=pb_automate
PORT=3000
FRONTEND_URL=http://localhost:5173
```

For local dev without a real PB account, you can skip PB_CLIENT_ID/SECRET — use the "Mock Workspace" button on the login page.

### 3. Start both servers

```bash
# Terminal 1 — Backend (http://localhost:3000)
cd backend
npm run dev

# Terminal 2 — Frontend (http://localhost:5173)
cd frontend
npm run dev
```

### 4. Use the app

1. Open http://localhost:5173
2. Click "Use Mock Workspace" (or enter a real PB Client ID for OAuth)
3. Pick a script (Sync Custom Field is fully implemented)
4. Configure field mapping, direction, and schedule
5. Deploy — the script runs immediately with mock data

## OAuth Flow

1. Frontend redirects to `https://app.productboard.com/oauth2/authorize`
2. PB redirects back to `/auth/callback` with `?code=`
3. Backend exchanges code for access token via `POST /oauth2/token`
4. Token stored in GCP Secret Manager (or in-memory for mock mode)
5. Backend returns a session JWT to the frontend

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/auth/login` | Redirect to PB OAuth |
| GET | `/auth/callback` | Token exchange, return JWT |
| POST | `/auth/mock` | Create mock session (local dev) |
| GET | `/scripts` | List available scripts |
| POST | `/scripts/deploy` | Save config, create scheduler job |
| POST | `/scripts/:id/run` | Manually trigger a script |
| GET | `/scripts/:id/logs` | Fetch run logs |
| POST | `/webhooks/pb` | Receive PB webhook events |
| GET | `/health` | Health check |

## GCP Deployment

### Prerequisites

- `gcloud` CLI authenticated
- A GCP project with billing enabled
- Docker installed

### Deploy

```bash
# Build and push Docker image
cd backend
gcloud builds submit --tag us-central1-docker.pkg.dev/YOUR_PROJECT/pb-automate/backend:latest

# Apply Terraform
cd ../infra
terraform init
terraform apply \
  -var="project_id=YOUR_PROJECT" \
  -var="pb_client_id=YOUR_PB_CLIENT_ID" \
  -var="pb_client_secret=YOUR_PB_CLIENT_SECRET" \
  -var="jwt_secret=YOUR_JWT_SECRET"
```

After deployment, update your PB OAuth app's redirect URI to the Cloud Run URL shown in the Terraform output.

## Available Scripts

| Script | Status | Description |
|--------|--------|-------------|
| syncField | Implemented | Sync custom field values between parent/child features |
| rollupScore | Placeholder | Aggregate child priority scores to parent |
| propagateTags | Placeholder | Copy tags from parent to child features |
