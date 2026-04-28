# FastAPI Backend Handoff

## Scope

This document is the current runtime, implementation, deployment, and acceptance baseline for the default backend in `opera-server-py/`.

## Goal

Run Opera exclusively on FastAPI for all three product flows: `内容转换`、`原创创作`、`微信公众号`.

`opera-server/` remains in the repository only as source reference and contract history. Its runtime and old Node acceptance entrypoints are intentionally disabled.

## Default Runtime Decision

- Default backend: `opera-server-py/`
- Windows local startup: repo root `./start-backend.ps1`
- Linux/macOS local startup: repo root `./start-backend.sh`
- Ubuntu / Docker full stack: repo root `docker compose up --build`
- Frontend API base contract:
  - dev default: `http://localhost:3001`
  - container / production default: same-origin `/api`
  - override: `VITE_API_BASE_URL`
- `opera-server/` is not part of normal run, acceptance, or deployment flows

## Compatibility Contract

The FastAPI backend must preserve all of the following:

- Dev base URL: `http://localhost:3001`
- Endpoints:
  - `GET /api/health`
  - `GET /api/providers`
  - `POST /api/generate`
  - `POST /api/compose`
  - `POST /api/wechat/compose`
- Request body for `POST /api/generate`:
  - `text`
  - `tone`
  - `provider?`
  - `model?`
- Request body for `POST /api/compose`:
  - `topic`
  - `contentType`
  - `tone`
  - `targetLength`
  - `provider?`
  - `model?`
  - `regenerate?` (`title` | `body` | `tags`)
- Request body for `POST /api/wechat/compose`:
  - `topic`
  - `articleType`
  - `tone`
  - `targetLength`
  - `provider?`
  - `model?`
  - `regenerate?` (`title` | `digest` | `body`)
- SSE event names:
  - `step`
  - `titles`
  - `cards`
  - `caption`
  - `title`
  - `digest`
  - `body`
  - `tags`
  - `error`
- Step values:
  - `extracting`
  - `titles`
  - `cards`
  - `caption`
  - `title`
  - `digest`
  - `body`
  - `tags`
  - `done`

## Directory Layout

```text
opera-server-py/
  app/
    main.py
    config.py
    types.py
    prompts.py
    prompts_composer.py
    prompts_wechat.py
    sse.py
    utils.py
    providers/
      base.py
      anthropic_provider.py
      openai_compat_provider.py
      factory.py
    routes/
      generate.py
      compose.py
      wechat_compose.py
  scripts/
    test_e2e.py
  tests/
    test_api_contract.py
    test_utils.py
  pyproject.toml
  .env.example
  Dockerfile
../start-backend.ps1
../start-backend.sh
../docker-compose.yml
```

## Runbook

### 1) Install dependencies

```bash
cd opera-server-py
python -m pip install -e ".[dev]"
```

### 2) Create environment file

Windows:

```powershell
Copy-Item .env.example .env
```

Linux/macOS:

```bash
cp .env.example .env
```

Then fill the provider variables required by your chosen model provider.

### 3) Start backend locally

Windows:

```powershell
./start-backend.ps1
```

Linux/macOS:

```bash
./start-backend.sh
```

Direct command:

```bash
cd opera-server-py
python -m uvicorn app.main:app --host 127.0.0.1 --port 3001
```

### 4) Start full stack on Ubuntu / Docker

```bash
docker compose up --build
```

Expected ports:

- frontend: `http://localhost:8080`
- backend health: `http://localhost:3001/api/health`
- frontend-to-backend traffic: proxied through `/api`

### 5) Runtime guard expectations

The following legacy Node entrypoints must refuse to run and redirect back to FastAPI:

```bash
cd opera-server
npm run dev
npm run legacy:dev
node test-e2e.mjs
```

## Required Validation Sequence

Validation should happen in this order:

1. Startup smoke test (`start-backend.ps1` or `start-backend.sh`)
2. Contract / unit validation (`python -m pytest -q`)
3. Real-key self-test (`python scripts/test_e2e.py`)
4. Frontend build validation (`cd ../opera-app && npm run build`)
5. Legacy guard validation (`cd ../opera-server && npm run legacy:dev`)
6. Docker / Ubuntu config validation (`docker compose config`; run `docker compose up --build` when Docker Engine is available)
7. Handoff update

## Completed Validation (2026-04-03)

Completed locally:

- `cmd /c "cd /d d:\vscodefile\opera\opera-app && npm run build"` → passed
- `cmd /c "cd /d d:\vscodefile\opera\opera-server-py && D:\software\anacond\python.exe -m pytest -q"` → passed (`25 passed`)
- `cmd /c "cd /d d:\vscodefile\opera\opera-server-py && D:\software\anacond\python.exe scripts\test_e2e.py"` → passed, covering `/api/generate`, `/api/compose`, and `/api/wechat/compose`
- `cmd /c "cd /d d:\vscodefile\opera\opera-server && npm run legacy:dev"` → passed as a guard check (startup correctly refused)

Previously validated in this workspace and still applicable to the current baseline:

- `docker compose config` → passed

Not completed on this machine:

- `docker compose up --build` smoke test, because the local Docker daemon was not running

## Operational Notes

- `opera-server-py/` is the only supported backend runtime
- `start-backend.ps1`, `start-backend.sh`, and `docker compose up --build` are the supported startup paths
- `opera-server/test-e2e.mjs` has been retired from the acceptance chain
- If `POST /api/compose` or `POST /api/wechat/compose` returns `404 {"error":"Not found"}`, the request is not reaching the FastAPI backend; restart the supported runtime entry and verify the `/api` proxy path
- `scripts/test_e2e.py` now boots the test server on a random free local port to avoid false failures when `:3001` is already occupied
- `app/utils.py::extract_json()` now tolerates fenced JSON and JSON wrapped by brief model preambles, reducing real-provider parsing flakiness
- `app/utils.py::preprocess_article_text()` now strips common pasted-article noise such as HTML tags, follow prompts, and `阅读原文` footer lines before `/api/generate` enters the LLM pipeline
- Current real-key validation was completed with the locally configured default provider

## Remaining Risks

- Anthropic/custom providers still need live-key verification when those credentials are available
- Docker config is validated, but container bring-up still needs to be exercised on a host with Docker Engine running
- No retry, rate limiting, or usage tracking has been added yet
- `微信公众号` Phase 1 is still local-draft only; no official account auth, draft sync, or publish flow is wired yet
