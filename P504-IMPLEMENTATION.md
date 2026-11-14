# P504 — Docker local application bootstrap

Version: 0.504.0-dev

## Delivered
- Reworked Docker Compose orchestration for PostgreSQL 16, Redis 7, migration job, API and web UI.
- API waits for successful migrations and Redis health; web waits for API readiness.
- PostgreSQL data persists in a named Docker volume and DB port binds to localhost.
- Added API and web container health checks.
- Added `.env.docker.example`; first-start scripts generate cryptographically strong local secrets and never overwrite an existing `.env`.
- Added one-command startup for macOS/Linux and Windows PowerShell, plus stop/log helpers.
- Added first-admin bootstrap instructions and operational troubleshooting.
- Added P504 static Docker config checks and cumulative release gate.
- AI, offline sync, consumer discovery, live payments and live notifications remain disabled by default.

## Verification performed in this workspace
- P504 Docker static checks: 10/10.
- P503 quarantine checks: 10/10.
- P502 refund integrity checks: 11/11.
- P501 inherited deterministic checks: 10/10.
- TypeScript/TSX syntax scan: 217 files, zero syntax diagnostics.
- Migration static validation: 214 ordered SQL files.
- Shell syntax check: `bash -n scripts/start.sh scripts/stop.sh scripts/logs.sh`.

## Not verified here
The current execution environment does not have Docker installed. Therefore Compose parsing by Docker, image builds, actual container startup, PostgreSQL migration execution, API readiness and browser rendering have not been run. The API Dockerfile uses the TypeScript dev runner in this local stack; a production image and deployment profile are still required. Dependency-backed full typechecks, unit tests and Playwright E2E remain open.

## Operator action
Install Docker Desktop/Engine + Compose v2, extract the archive, run `scripts/start.ps1` (Windows) or `./scripts/start.sh` (macOS/Linux), then create the first admin using `docs/DOCKER-QUICKSTART.md`. Send back the complete output of `docker compose ps` and `docker compose logs --tail=150 migrate api web` if startup fails.
