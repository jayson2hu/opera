# Opera

Opera is an AI-assisted content creation workspace for adapting source articles and drafting social posts. The current supported runtime is:

- Frontend: React + Vite in `opera-app/`
- Backend: FastAPI in `opera-server-py/`
- Legacy reference backend: `opera-server/` is retained for contract history only and intentionally refuses runtime startup

## What It Does

- Content Adapter: paste an article and generate Xiaohongshu cover titles, slide cards, caption, and hashtags.
- XHS Composer: generate an editable Xiaohongshu post from a topic.
- WeChat Composer: generate title, digest, body, and local draft content from a topic.

## Documentation

- [Project overview](docs/PROJECT.md)
- [Deployment guide](docs/DEPLOYMENT.md)
- [Review notes](docs/REVIEW.md)
- [Follow-up plan](docs/PLAN.md)
- [Documentation index](docs/INDEX.md)

Historical handoff and feature PRD documents have been moved under `docs/archive/` and `docs/features/`.

## Quick Start

1. Configure backend environment:

   ```powershell
   Copy-Item opera-server-py\.env.example opera-server-py\.env
   ```

   Fill in the provider key for `AI_PROVIDER`. Supported provider ids are:

   - `anthropic`: Claude official API
   - `anthropic_compat`: third-party Claude gateway using the Anthropic-compatible protocol
   - `openai`: ChatGPT/OpenAI official API
   - `openai_compat`: third-party ChatGPT/OpenAI gateway using the OpenAI-compatible protocol
   - `deepseek`: DeepSeek
   - `custom`: legacy OpenAI-compatible provider

2. Start backend from the repo root:

   ```powershell
   .\start-backend.ps1
   ```

3. Start frontend:

   ```powershell
   Set-Location opera-app
   npm install
   npm run dev
   ```

4. Open `http://localhost:5173`.

## Docker

From the repo root:

```bash
docker compose up --build
```

Expected endpoints:

- Frontend: `http://localhost:8080`
- Backend health: `http://localhost:3001/api/health`
- Frontend API proxy: `http://localhost:8080/api/*`

## Validation

Recommended checks before release:

```bash
cd opera-server-py
python -m pytest -q

cd ../opera-app
npm run lint
npm run build

cd ..
docker compose config
```

See [Review notes](docs/REVIEW.md) for the latest validation result and known risks.
