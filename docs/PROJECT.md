# Project Overview

## Summary

Opera is a content creation workspace that helps users transform topics or long-form source material into social publishing drafts. It currently supports three flows: article-to-XHS adaptation, XHS post composition, and WeChat article composition.

## Repository Layout

```text
.
  opera-app/          React + Vite frontend
  opera-server-py/    supported FastAPI backend
  opera-server/       disabled legacy Node backend, kept as reference
  docs/               canonical project documentation
  docker-compose.yml  full-stack container setup
  start-backend.ps1   Windows backend launcher
  start-backend.sh    Linux/macOS backend launcher
```

## Frontend

`opera-app/` is a React 19 + Vite application. It exposes the main workspace screens and consumes backend APIs using Server-Sent Events for streaming generation progress.

Important scripts:

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

API base behavior:

- Local dev default: `http://localhost:3001`
- Production/container default: same-origin `/api`
- Override: `VITE_API_BASE_URL`

## Backend

`opera-server-py/` is the supported runtime backend. It is a FastAPI service that validates requests, calls the configured LLM provider, and streams generation events back to the frontend.

Supported provider modes:

- `anthropic`
- `deepseek`
- `custom` OpenAI-compatible provider

Required environment file:

```text
opera-server-py/.env
```

Create it from:

```text
opera-server-py/.env.example
```

## Runtime Contract

Backend base URL in local development:

```text
http://localhost:3001
```

Endpoints:

- `GET /api/health`
- `GET /api/providers`
- `POST /api/generate`
- `POST /api/compose`
- `POST /api/wechat/compose`

SSE events used by the frontend:

- `step`
- `titles`
- `cards`
- `caption`
- `title`
- `digest`
- `body`
- `tags`
- `error`

Expected step values:

- `extracting`
- `titles`
- `cards`
- `caption`
- `title`
- `digest`
- `body`
- `tags`
- `done`

## Legacy Node Backend

`opera-server/` is not part of the normal runtime, acceptance, or deployment path. Its npm runtime scripts intentionally fail and point users to the FastAPI backend.
