# Follow-Up Plan

Status date: 2026-04-28

## Completed

- Consolidated project documentation under `docs/`.
- Added root `README.md`.
- Verified backend unit tests: `python -m pytest -q`.
- Verified frontend lint: `npm.cmd run lint`.
- Verified frontend production build outside the restricted sandbox: `npm.cmd run build`.
- Added GitHub Actions CI for backend tests, frontend lint/build, and Docker Compose config validation.

## Planned But Not Run Yet

- Docker full-stack smoke test: `docker compose up --build`.
  This is intentionally not run yet per current instruction.

## Still Open

- Live provider E2E: run `python scripts/test_e2e.py` after confirming real API usage is acceptable.
- Historical document encoding repair: archived handoff/PRD files still contain mojibake in places.
- Local shell cleanup: PowerShell profile loading errors appear on every command in this environment.
- Local temp artifact cleanup: ignored `tmp-*` logs remain in the workspace for current service troubleshooting.
