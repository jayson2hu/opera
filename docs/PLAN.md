# Follow-Up Plan

Status date: 2026-04-28

## Completed

- Consolidated project documentation under `docs/`.
- Added root `README.md`.
- Verified backend unit tests: `python -m pytest -q`.
- Verified frontend lint: `npm.cmd run lint`.
- Verified frontend production build outside the restricted sandbox: `npm.cmd run build`.
- Added GitHub Actions CI for backend tests, frontend lint/build, and Docker Compose config validation.
- Verified live provider E2E: `python scripts/test_e2e.py`.
- Added clean archive/feature index notes for historical mojibake documents.
- Disabled local PowerShell profile files by renaming them to `.disabled` backups to stop execution-policy noise.
- Set repository-local Git `core.excludesfile` to `.git/info/exclude` to avoid an inaccessible user-level ignore warning.
- Removed stale local temp files; active service logs remain while the dev servers are running.

## Planned But Not Run Yet

- Docker full-stack smoke test: `docker compose up --build`.
  Status: deferred by request. Do not run in this pass.

## Still Open

- Live provider E2E.
  Status: completed. The E2E script now uses clean stable sample inputs and passed for `/api/generate`, `/api/compose`, and `/api/wechat/compose`.
- Historical document encoding repair.
  Status: completed for this pass. Added clean archive/feature indexes and reliability notes; unrecoverable original mojibake was left unchanged to avoid inventing historical content.
- Local shell cleanup.
  Status: completed. `profile.ps1` and `Microsoft.PowerShell_profile.ps1` were renamed to `.disabled` backups after execution policy changes did not affect this shell path.
- Local temp artifact cleanup.
  Status: completed for stale files. Current backend/frontend runtime logs remain while the services are active.
