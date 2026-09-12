# Deployment Guide

## Prerequisites

- Node.js compatible with the frontend dependency set
- Python 3.12 for the locked, tested backend environment (the package declares 3.11+)
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

For a third-party Claude gateway that uses the Anthropic-compatible protocol:

```env
AI_PROVIDER=anthropic_compat
ANTHROPIC_COMPAT_API_KEY=...
ANTHROPIC_COMPAT_BASE_URL=https://claude-gateway.example.com
ANTHROPIC_COMPAT_MODEL=claude-sonnet-4-20250514
```

For official ChatGPT/OpenAI models:

```env
AI_PROVIDER=openai
OPENAI_API_KEY=...
OPENAI_BASE_URL=https://api.openai.com
OPENAI_MODEL=gpt-5.2
OPENAI_MODELS=gpt-5.2,gpt-5.2-chat-latest
```

For a third-party ChatGPT/OpenAI gateway that uses the OpenAI-compatible chat completions protocol:

```env
AI_PROVIDER=openai_compat
OPENAI_COMPAT_API_KEY=...
OPENAI_COMPAT_BASE_URL=https://openai-gateway.example.com/v1
OPENAI_COMPAT_MODEL=gpt-4o
```

For DeepSeek:

```env
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=...
```

For the legacy OpenAI-compatible relay configuration:

```env
AI_PROVIDER=custom
CUSTOM_API_KEY=...
CUSTOM_BASE_URL=https://example.com/v1
CUSTOM_MODEL=...
```

Prefer `openai_compat` for new third-party OpenAI-compatible gateways. Use `anthropic_compat` for third-party Claude gateways that follow the Anthropic Messages API shape. Do not configure a Claude-compatible gateway as `openai_compat` unless that gateway explicitly exposes Claude models through OpenAI-compatible chat completions.

Never commit `.env` files.

## Local Development

For a reproducible backend environment, install the checked-in hashes into a project
virtual environment using Python 3.12. Do not replace an existing environment without
checking whether it contains local work; use a separate directory if needed:

```bash
python3.12 -m venv opera-server-py/.venv
opera-server-py/.venv/bin/python -m pip install --require-hashes --only-binary=:all: -r opera-server-py/requirements-dev.lock
opera-server-py/.venv/bin/python -m pip check
opera-server-py/.venv/bin/python opera-server-py/scripts/check_dependency_locks.py
```

`requirements.lock` contains the production dependency closure;
`requirements-dev.lock` adds the test/lint closure and uses identical runtime versions.
Docker and CI install these files with hash verification instead of resolving the
`pyproject.toml` ranges on every run. Production runs the source from `/app`, so it does
not need an unpinned build-backend or editable installation. Binary-only installation
fails if a supported wheel is missing instead of resolving unpinned source-build tools.
Regeneration commands are
recorded in each lockfile; regenerate both after changing dependencies and rerun the
lock checker, tests and `pip check`. Other Python/platform combinations need their own
validation; successful Python 3.12/Linux checks do not certify all declared platforms.

Start the backend from the repository root.

Windows:

```powershell
.\start-backend.ps1
```

Linux/macOS:

```bash
PYTHON_EXE="$PWD/opera-server-py/.venv/bin/python" ./start-backend.sh
```

Start the frontend:

```bash
cd opera-app
npm ci
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

- Frontend: `127.0.0.1:8080`
- Backend: `127.0.0.1:3001`

Both ports bind to loopback by default because this MVP has no application-level
authentication. For another local stack, set `OPERA_FRONTEND_PORT` and
`OPERA_BACKEND_PORT`, and choose a distinct Compose project with `-p`. Container
names are project-scoped. `OPERA_BIND_ADDRESS` can change the bind address for a
deployment with an explicitly access-controlled network or reverse proxy; changing
the address does not add authentication.

Health check:

```bash
curl http://localhost:3001/api/health
```

The frontend Nginx image proxies `/api/*` to the backend service at `http://backend:3001`.
It uses the Nginx 1.30.4 stable image pinned by digest, and Compose checks frontend
HTTP health before an acceptance stack is considered ready. Review the official
[security advisories](https://nginx.org/en/security_advisories.html) when updating this
pin; an immutable image still needs deliberate security maintenance.

## Frontend API Base

By default, the frontend uses:

- `http://localhost:3001` in Vite dev mode
- same-origin `/api` in production builds

To target a custom API origin in a local frontend build:

```bash
VITE_API_BASE_URL=https://api.example.com npm run build
```

For Docker Compose, pass the same build-time variable when rebuilding the frontend.

Bash:

```bash
VITE_API_BASE_URL=https://api.example.com docker compose up --build
```

PowerShell:

```powershell
$env:VITE_API_BASE_URL = 'https://api.example.com'
docker compose up --build
Remove-Item Env:VITE_API_BASE_URL
```

`VITE_API_BASE_URL` is compiled into the frontend bundle. Changing it only on a running
container has no effect; rebuild the frontend image whenever this value changes.

When the frontend and API use different origins, also allow the frontend origin in the
backend environment file:

```env
CORS_ORIGINS=https://app.example.com,https://admin.example.com
```

`CORS_ORIGINS` is a comma-separated allowlist of exact browser origins. Each entry must
contain only `http://` or `https://`, a hostname, and an optional port. Do not use `*`,
paths, query strings, or fragments. Setting the variable replaces the local-development
defaults; when it is unset, the backend allows:

- `http://localhost:5173`
- `http://localhost:5174`
- `http://127.0.0.1:5173`
- `http://127.0.0.1:5174`

The backend fails during startup if the allowlist is empty or contains an invalid origin.
The API origin itself belongs in `VITE_API_BASE_URL`; `CORS_ORIGINS` must contain the
frontend origin shown in the browser address bar.

## Pre-Release Checks

Run these checks before deployment:

```bash
cd opera-server-py
python -m pytest -q

cd ../opera-app
npm ci
npm audit --include=dev --audit-level=low
npm run test
npm run lint
npm run build

cd ..
docker compose config --quiet
python opera-server-py/scripts/check_compose_api_base.py
```

Raw `docker compose config` output expands values from `env_file`, including provider
keys. Use `--quiet` for validation and do not publish the expanded configuration. The
API-base contract script disables service env-file resolution and prints only pass/fail state.
It also checks loopback defaults, custom ports, and project-scoped container names.

For isolated Ubuntu/Docker acceptance without real API credentials, see
[`tests/acceptance/README.md`](../tests/acceptance/README.md). The overlay disables
the real backend env file, uses a local protocol fixture, and runs the production
Dockerfiles and Nginx proxy. Stop its unique project and remove its builder/cache
when finished; never prune unrelated Docker resources.

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
