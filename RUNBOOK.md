# Alcohol Commerce Platform — Local Docker Runbook

This guide runs the application on a local Docker Desktop installation. It is for development and disposable testing only, not production.

## Requirements

- Docker Desktop installed and running (macOS or Windows), or Docker Engine with Docker Compose v2 (Linux).
- Internet access for the initial image build and npm dependency download.
- Available host ports. The generated Docker environment uses API `8080` and web `5173`; a pre-existing `.env` may override them.

## Start the application

Open a terminal in the project root and run:

```bash
./scripts/start.sh
```

In Windows PowerShell:

```powershell
.\scripts\start.ps1
```

The start script checks Docker Compose, creates `.env` with random local secrets if it does not exist, builds the API and web images, starts PostgreSQL and Redis, runs pending database migrations, and waits for API and web health checks. It does not replace an existing `.env`.

Do not commit, publish, or share `.env`. If startup reports placeholder secrets in an existing file, replace the values for `POSTGRES_PASSWORD`, `JWT_SECRET`, and `BOOTSTRAP_SECRET` with unique local secrets. Never paste secret values into a ticket or chat.

After startup, use the URLs printed by the script. To see the configured host ports without displaying secrets:

```bash
grep -E '^(API_PORT|WEB_PORT)=' .env
```

The web app is `http://localhost:<WEB_PORT>`. The API is `http://localhost:<API_PORT>`. Health checks:

- `http://localhost:<API_PORT>/api/health/live`
- `http://localhost:<API_PORT>/api/health/ready`

The readiness endpoint also checks the database.

## Docker Desktop services

| Service | Purpose |
|---|---|
| `postgres` | PostgreSQL 16; data is stored in the `postgres_data` Docker volume. |
| `redis` | Redis 7 used by the API. |
| `migrate` | One-shot database migration job run before the API starts. |
| `api` | Backend API, exposed on the configured host API port. |
| `web` | Vite web application, exposed on the configured host web port. |

Ports are bound to loopback (`127.0.0.1`) and the database and Redis ports are not published to the host. The Compose configuration keeps AI, offline sync, consumer discovery, live payments, and live notifications disabled.

## Login accounts and passwords

There are **no built-in default usernames with a shared default password**. The project does not ship demo credentials. The optional local demo seeder creates one account for each role in the migrated database, and all those accounts share the unique password you provide when seeding. Passwords must be 14–128 characters. The password is not displayed by the seeder.

Some older phase notes in `doc-new/` show sample passwords in their examples. Those are historical examples only; they are not configured automatically and must not be treated as working default credentials.

The current migrated database has these demo login emails:

| Role | Username / email | Password |
|---|---|---|
| Auditor | `auditor@demo.acp.local` | Your chosen `DEMO_SEED_PASSWORD` |
| Bartender | `bartender@demo.acp.local` | Your chosen `DEMO_SEED_PASSWORD` |
| Bar manager | `bar.manager@demo.acp.local` | Your chosen `DEMO_SEED_PASSWORD` |
| Bar owner | `bar.owner@demo.acp.local` | Your chosen `DEMO_SEED_PASSWORD` |
| Brand admin | `brand.admin@demo.acp.local` | Your chosen `DEMO_SEED_PASSWORD` |
| Brand analyst | `brand.analyst@demo.acp.local` | Your chosen `DEMO_SEED_PASSWORD` |
| Cashier | `cashier@demo.acp.local` | Your chosen `DEMO_SEED_PASSWORD` |
| Distributor admin | `distributor.admin@demo.acp.local` | Your chosen `DEMO_SEED_PASSWORD` |
| Platform administrator | `platform.admin@demo.acp.local` | Your chosen `DEMO_SEED_PASSWORD` |
| Outlet manager | `outlet.manager@demo.acp.local` | Your chosen `DEMO_SEED_PASSWORD` |
| Retail manager | `retail.manager@demo.acp.local` | Your chosen `DEMO_SEED_PASSWORD` |
| Retail owner | `retail.owner@demo.acp.local` | Your chosen `DEMO_SEED_PASSWORD` |
| Sales representative | `sales.rep@demo.acp.local` | Your chosen `DEMO_SEED_PASSWORD` |

The seeded account list is database-driven and can change when migrations add roles. Check the current complete list with:

```bash
docker compose exec -T postgres psql -U acp -d acp -Atc \
  "SELECT DISTINCT role_code FROM role_permissions WHERE role_code <> '' ORDER BY role_code"
```

For each role code, the email is its lowercase form with non-alphanumeric runs replaced by dots, followed by `@demo.acp.local`. For example, `FINANCE_MANAGER` becomes `finance.manager@demo.acp.local`.

### Create or reset local demo users

Only do this in a disposable local database. The seeder refuses to run in production, requires explicit opt-in, and creates/reuses an `ACP Local Demo` organisation and `DEMO-001` outlet for non-platform roles. Rerunning it resets the demo accounts to the newly supplied password.

macOS/Linux (enter the password interactively; it will not be echoed):

```bash
read -r -s -p "Choose a local demo password (14-128 characters): " DEMO_SEED_PASSWORD
printf '\n'
export DEMO_SEED_PASSWORD
docker compose exec \
  -e DEMO_SEED_ENABLED=true \
  -e DEMO_SEED_PASSWORD \
  api npm run db:seed:demo --workspace @acp/api
unset DEMO_SEED_PASSWORD
```

Windows PowerShell:

```powershell
$securePassword = Read-Host "Choose a local demo password (14-128 characters)" -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
  $env:DEMO_SEED_ENABLED = 'true'
  $env:DEMO_SEED_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
  docker compose exec -e DEMO_SEED_ENABLED -e DEMO_SEED_PASSWORD api npm run db:seed:demo --workspace @acp/api
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
  Remove-Item Env:DEMO_SEED_PASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:DEMO_SEED_ENABLED -ErrorAction SilentlyContinue
}
```

Use the password you just supplied with any listed email on the web app login screen. The seeder does not reveal the password later; if you forget it, rerun the seeder with a new one.

## Everyday Docker commands

Run commands from the project root:

```bash
# See service status and health
docker compose ps

# Follow logs
docker compose logs -f --tail=150

# Inspect service logs
docker compose logs --tail=200 postgres redis migrate api web

# Rebuild and restart
docker compose up -d --build

# Stop containers; preserve PostgreSQL data
docker compose down
```

## Bootstrap a non-demo administrator

The API also has a one-time platform-admin bootstrap endpoint, but it does not create demo role accounts or automatically configure an outlet. Follow the authentication instructions in [`docs/P03-AUTHENTICATION.md`](docs/P03-AUTHENTICATION.md) and use only the local `BOOTSTRAP_SECRET` from `.env`. Treat it as a secret and do not place it in source control.

## Troubleshooting

```bash
docker compose ps
docker compose logs --tail=200 postgres redis migrate api web
docker compose build --no-cache api web
docker compose up -d
```

- **A port is busy:** change the host `API_PORT` or `WEB_PORT` in `.env`, then restart.
- **Migration failed:** inspect the first SQL error in `migrate` logs. The API intentionally waits for successful migrations.
- **API is unhealthy:** check PostgreSQL and Redis health before restarting.
- **Cannot log in:** confirm demo seeding succeeded and use the exact password entered at seed time.
- **First build takes time:** Docker must download base images and install dependencies.

## Database data and cleanup

`docker compose down` stops containers but preserves the named PostgreSQL volume. **Do not use `docker compose down -v` unless you intend to permanently delete the local database and all its data.** Back up any data you need before restoring, resetting, or removing volumes.

This local environment is not production-ready. Do not put real customer, payment, licence, or alcohol transaction data into it, and do not enable live integrations for local testing.

## Documentation files

Historical root-level documents are collected in [`doc-new/`](doc-new/); this current runbook stays at the project root. Existing documents under [`docs/`](docs/) are kept in place.

Delivery and phase manifest files are collected in [`manifests/`](manifests/). Verification, release-gate, and audit JSON files are collected in [`reports/`](reports/). The root `package.json` remains in place because npm workspaces and Docker builds require it.
