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
- `anthropic_compat`
- `openai`
- `openai_compat`
- `deepseek`
- `custom` legacy OpenAI-compatible provider

Provider protocol mapping:

- `anthropic`: Claude official API through the Anthropic Messages protocol.
- `anthropic_compat`: third-party Claude gateway through an Anthropic-compatible protocol.
- `openai`: official ChatGPT/OpenAI API through the OpenAI-compatible chat completions protocol.
- `openai_compat`: third-party ChatGPT/OpenAI gateway through the OpenAI-compatible chat completions protocol.
- `deepseek`: DeepSeek through the OpenAI-compatible chat completions protocol.
- `custom`: legacy OpenAI-compatible relay configuration retained for backward compatibility.

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
- `POST /api/generate/continue`
- `POST /api/compose`
- `POST /api/wechat/compose`
- `POST /api/rewrite-paragraph`

`/api/rewrite-paragraph` accepts `{text, instruction, provider?, model?}` and returns
`{text}` for the paragraph-level editor action. It is a synchronous JSON request; the
three composition endpoints remain SSE streams.

SSE events used by the frontend:

- `step`
- `extraction_points`
- `titles`
- `cards`
- `cards_v2` (additive typed-card event; legacy `cards` remains supported)
- `caption`
- `title`
- `digest`
- `body`
- `tags`
- `error`

Expected step values:

- `extracting`
- `paused` (article extraction waits for user confirmation before `/generate/continue`)
- `titles`
- `cards`
- `caption`
- `title`
- `digest`
- `body`
- `tags`
- `done`

## Draft and candidate architecture

`useDraftWorkspace` and `draftWorkspace` own browser-local draft IDs, schema-versioned
records, revision checks, migration, and version snapshots. The three flow pages own
editing and generation state; shared editors expose manual editing and explicit AI
candidate approval. Candidate application compares the complete current result with
the request snapshot and saves the previous version before replacing content.

Local drafts remain editable when providers are unavailable. Images and unapproved
candidates are temporary; localStorage is not cross-window transactional storage or a
cloud draft service. `currentContent` on partial compose requests supplies the current
title/body/digest so the backend generates only the selected block.

Production requests follow React → same-origin Nginx `/api` proxy → FastAPI routes →
provider adapters. Docker defaults bind to loopback; a deployment that permits remote
access must supply its own access control. Integration fixtures in `tests/acceptance/`
exercise the actual production images and protocol adapters without a paid provider.

## Legacy Node Backend

`opera-server/` is not part of the normal runtime, acceptance, or deployment path. Its npm runtime scripts intentionally fail and point users to the FastAPI backend.
