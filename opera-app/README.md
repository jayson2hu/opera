# Opera App

`opera-app/` is the React + Vite frontend for the Opera content creation workspace.

## Current UI Status

The frontend now exposes three production-facing work areas:

- Content Adapter: paste an existing article and generate XHS titles, slide cards, caption, and hashtags.
- XHS Composer: start from a topic and generate an editable XHS post.
- WeChat Composer: start from a topic and generate a title, digest, body, and local pending-sync draft.

## Latest Validation (2026-04-25)

- `npm.cmd run build` -> PASS
- `npm.cmd run lint` -> PASS
- User-facing mojibake cleanup completed for core workspace components and pages.

## Runtime Contract

- Local development backend default: `http://localhost:3001`
- Container / production default: same-origin `/api`
- Override with: `VITE_API_BASE_URL`
- Supported backend runtime: `opera-server-py/`
- `opera-server/` is no longer a runtime or acceptance target

## Local Development

1. Start the default backend from the repo root:
   - Windows: `./start-backend.ps1`
   - Linux/macOS: `./start-backend.sh`
2. Start the frontend:

   ```bash
   cd opera-app
   npm install
   npm run dev
   ```

3. Open `http://localhost:5173`

## Build

```bash
cd opera-app
npm run build
```

## Docker / Ubuntu

From the repo root:

```bash
docker compose up --build
```

Expected endpoints:

- frontend: `http://localhost:8080`
- backend health: `http://localhost:3001/api/health`
- frontend API traffic: `http://localhost:8080/api/*` proxied to FastAPI

The Docker stack reads backend secrets from `opera-server-py/.env`.

## Troubleshooting

- If `/api/compose` returns `404 {"error":"Not found"}`, the request is not reaching the default FastAPI backend.
- Check that you started the backend with `start-backend.ps1`, `start-backend.sh`, or `docker compose up --build`.
- If you need a custom backend origin in development or deployment, set `VITE_API_BASE_URL` before building or starting the frontend.

<!-- Historical content below may include older handoff text. -->

# Opera App

`opera-app/` is the React + Vite frontend for the Opera content creation workspace.

## Runtime Contract

- Local development backend default: `http://localhost:3001`
- Container / production default: same-origin `/api`
- Override with: `VITE_API_BASE_URL`
- Supported backend runtime: `opera-server-py/`
- `opera-server/` is no longer a runtime or acceptance target

## Local Development

1. Start the default backend from the repo root:
   - Windows: `./start-backend.ps1`
   - Linux/macOS: `./start-backend.sh`
2. Start the frontend:

   ```bash
   cd opera-app
   npm install
   npm run dev
   ```

3. Open `http://localhost:5173`

## Build

```bash
cd opera-app
npm run build
```

## Docker / Ubuntu

From the repo root:

```bash
docker compose up --build
```

Expected endpoints:

- frontend: `http://localhost:8080`
- backend health: `http://localhost:3001/api/health`
- frontend API traffic: `http://localhost:8080/api/*` → proxied to FastAPI

The Docker stack reads backend secrets from `opera-server-py/.env`.

## Troubleshooting

- If `/api/compose` returns `404 {"error":"Not found"}`, the request is not reaching the default FastAPI backend.
- Check that you started the backend with `start-backend.ps1`, `start-backend.sh`, or `docker compose up --build`.
- If you need a custom backend origin in development or deployment, set `VITE_API_BASE_URL` before building or starting the frontend.
