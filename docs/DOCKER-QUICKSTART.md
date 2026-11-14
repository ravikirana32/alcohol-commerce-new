# Docker Quickstart — Alcohol Commerce Platform P505

This is a **local development/test stack**, not a production deployment. It starts PostgreSQL, Redis, runs database migrations, then starts the API and React/Vite web application.

## Prerequisites (manual)

1. Install Docker Desktop on Windows/macOS, or Docker Engine plus Docker Compose v2 on Linux.
2. Start Docker and wait until its engine is running.
3. On Linux, ensure your user can access Docker (`docker` group membership or `sudo`).
4. Keep ports 5432, 6379, 8080 and 5173 available, or change the matching port values in `.env` before startup.
5. Internet access is required on the first run to download container images and npm dependencies.

## Start everything — one command

**Windows PowerShell** (from the extracted project root):

```powershell
.\scripts\start.ps1
```

**macOS/Linux**:

```bash
chmod +x scripts/start.sh
./scripts/start.sh
```

The script creates `.env` once with random local secrets if it does not exist, builds the app containers, starts PostgreSQL and Redis, runs pending migrations, starts the API and web app, and waits for health checks. It does not overwrite an existing `.env`.

## URLs

- Web app: http://localhost:5173
- API: http://localhost:8080
- API liveness: http://localhost:8080/api/health/live
- API readiness (includes PostgreSQL): http://localhost:8080/api/health/ready

## First-time manual admin setup

The application intentionally does not invent an administrator email/password. After the API is healthy, create the first platform administrator once. Read `BOOTSTRAP_SECRET` from your local `.env`, then run the following in PowerShell (replace the sample values):

```powershell
$secret = (Select-String '^BOOTSTRAP_SECRET=' .env).Line.Split('=',2)[1]
$body = @{
  bootstrapSecret = $secret
  email = 'admin@example.com'
  displayName = 'Platform Administrator'
  password = 'Replace-With-A-Unique-Password-At-Least-12-Chars'
} | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri 'http://localhost:8080/api/v1/auth/bootstrap' -ContentType 'application/json' -Body $body
```

On macOS/Linux, use the documented curl flow in `docs/P03-AUTHENTICATION.md`, substituting the `BOOTSTRAP_SECRET` from `.env`. Treat this as a one-time secret. Rotate/remove it after bootstrap according to the auth runbook; do not commit `.env` or share its values.

The current starter's organisation/outlet/licence setup may require platform-admin/API workflows that are not fully exposed in the UI. Do not assume bootstrap alone creates a ready-to-trade outlet.

## Everyday commands

```bash
# Start / rebuild all services
./scripts/start.sh

# Follow logs
./scripts/logs.sh

# Stop containers but preserve database data
./scripts/stop.sh

# Inspect service status
 docker compose ps

# Run static verification from host (Node.js required)
npm run verify:p504:docker
npm run verify:p503
npm run verify:p502
npm run verify:p501
```

PowerShell equivalents after startup:

```powershell
docker compose logs -f --tail=150
docker compose ps
docker compose down
```

## Database commands

```bash
# Migration status / migration runner in API container
# Check the scripts available in apps/api/package.json before invoking.
docker compose run --rm migrate

# Backup (script writes a timestamped file under backups/)
./scripts/db-backup.sh
```

Do not use `docker compose down -v` unless you intentionally want to permanently delete the local PostgreSQL volume and all local data. For a clean disposable test database, back up first and confirm the volume name before removal.

## Troubleshooting

```bash
docker compose ps
docker compose logs --tail=200 postgres redis migrate api web
docker compose build --no-cache api web
docker compose up -d
```

If migration fails, the API is deliberately held back because it depends on successful migration completion. Fix the first SQL error in `migrate` logs before restarting. If a port is busy, change its host port in `.env` and restart.

## Security and scope

- Development defaults keep AI, consumer discovery, offline sync, live payments and live notifications disabled.
- PostgreSQL is bound to localhost, not exposed on the LAN by default.
- The generated `.env` is local-only; use a secrets manager and separate hardened deployment configuration for staging/production.
- Do not enter real customer, payment, licence or alcohol transaction data in this developer environment.
- Docker startup is not a substitute for Karnataka excise/legal approval, independent security testing, database tenant-isolation validation or an authorised outlet pilot.
