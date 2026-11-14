# P505 — PostgreSQL Integration Test Harness

Version: `0.505.0-dev`

## Delivered
- Added an isolated PostgreSQL migration integration harness at `scripts/verify-p505-postgres.mjs`.
- The harness creates a uniquely named disposable database, applies ordered SQL migrations transactionally, verifies the migration/checksum ledger, checks core organisation/outlet tables, and drops only the database it created.
- Added environment preflight and npm scripts: `verify:p505:env`, `verify:p505:postgres`, and `verify:p505`.
- Updated root/API/web package versions to `0.505.0-dev`.

## Run
Set `TEST_DATABASE_ADMIN_URL` to a PostgreSQL admin connection string for a disposable test server. The role must be permitted to create and drop databases.

PowerShell:
```powershell
$env:TEST_DATABASE_ADMIN_URL = "postgresql://acp_test:YOUR_TEST_PASSWORD@localhost:5432/postgres"
npm run verify:p505
```

macOS/Linux:
```bash
export TEST_DATABASE_ADMIN_URL='postgresql://acp_test:YOUR_TEST_PASSWORD@localhost:5432/postgres'
npm run verify:p505
```

Do not point this at production or any database containing user data. The harness creates a random database name and only drops that exact database. Set `P505_KEEP_TEST_DATABASE=1` only when deliberately retaining the test database for inspection.

## Verification limits
The static environment preflight can run without PostgreSQL. The database integration test requires a live PostgreSQL server and installed workspace dependencies (`pg`). If the URL is absent, the command exits with status 2 and reports BLOCKED, not PASS. No live PostgreSQL execution is claimed in the artifact build environment.
