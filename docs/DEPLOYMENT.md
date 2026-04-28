# Deployment Guide

## Prerequisites

- Node.js compatible with the frontend dependency set
- Python 3.11 or newer
- Docker and Docker Compose for container deployment
- Provider credentials for the selected `AI_PROVIDER`

## Environment Configuration

Create the backend environment file:

```bash
cp opera-server-py/.env.example opera-server-py/.env
```

On Windows PowerShell:

```powershell
Copy-Item opera-server-py\.env.example opera-server-py\.env
```

Set one provider as the default:

```env
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=...
```

For DeepSeek:

```env
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=...
```

For an OpenAI-compatible relay:

```env
AI_PROVIDER=custom
CUSTOM_API_KEY=...
CUSTOM_BASE_URL=https://example.com/v1
CUSTOM_MODEL=...
```

Never commit `.env` files.

## Local Development

Start the backend from the repository root.

Windows:

```powershell
.\start-backend.ps1
```

Linux/macOS:

```bash
./start-backend.sh
```

Start the frontend:

```bash
cd opera-app
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

## Docker Deployment

From the repository root:

```bash
docker compose up --build
```

Published ports:

- Frontend: `8080`
- Backend: `3001`

Health check:

```bash
curl http://localhost:3001/api/health
```

The frontend Nginx image proxies `/api/*` to the backend service at `http://backend:3001`.

## Frontend API Base

By default, the frontend uses:

- `http://localhost:3001` in Vite dev mode
- same-origin `/api` in production builds

To target a custom API origin:

```bash
VITE_API_BASE_URL=https://api.example.com npm run build
```

## Pre-Release Checks

Run these checks before deployment:

```bash
cd opera-server-py
python -m pytest -q

cd ../opera-app
npm run lint
npm run build

cd ..
docker compose config
```

`docker compose config` expands values from `env_file`, including provider keys. Use it locally for validation, but do not publish raw output.

When provider credentials are available, also run the live backend self-test:

```bash
cd opera-server-py
python scripts/test_e2e.py
```

## Rollback

For Docker deployments, roll back by redeploying the previous image or previous Git revision, then verify:

- `GET /api/health`
- one successful generation flow through the frontend
- no frontend console errors for `/api/*` requests
