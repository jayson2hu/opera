# Opera App

`opera-app/` is the React + Vite frontend for the Opera content creation workspace.

The canonical project documentation now lives at the repository root and in `docs/`:

- `../README.md`
- `../docs/PROJECT.md`
- `../docs/DEPLOYMENT.md`
- `../docs/REVIEW.md`

## Local Development

- Local development backend default: `http://localhost:3001`
- Container / production default: same-origin `/api`
- Override with: `VITE_API_BASE_URL`
- Supported backend runtime: `opera-server-py/`

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

## Docker

From the repo root:

```bash
docker compose up --build
```

Expected endpoints:

- frontend: `http://localhost:8080`
- backend health: `http://localhost:3001/api/health`
- frontend API traffic: `http://localhost:8080/api/*` proxied to FastAPI

The Docker stack reads backend secrets from `opera-server-py/.env`.
