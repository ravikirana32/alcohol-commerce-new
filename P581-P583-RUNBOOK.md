# P581–P583 Runbook

## Apply locally
1. Extract the cumulative ZIP.
2. Copy `.env.example` to `.env` and set strong local-only secrets and PostgreSQL connection settings.
3. Start dependencies: `docker compose up -d --build`.
4. Install dependencies from repository root: `npm ci` (or `npm install` if no lockfile is present).
5. Apply forward-only migrations: `npm run db:migrate`.
6. Start services: `npm run dev`.
7. Run static checks:
   - `node scripts/verify-p581-report-governance.mjs`
   - `node scripts/verify-p582-provider-adapters.mjs`
   - `node scripts/verify-p583-security-hardening.mjs`
   - `node scripts/verify-p579-p580-migrations.mjs`
   - `node scripts/check-typescript-syntax.mjs`

## New API routes
- `GET/POST /api/v1/reports/governance/saved`
- `POST /api/v1/reports/governance/saved/:id/status`
- `GET /api/v1/reports/governance/executions`
- `POST /api/v1/reports/governance/export-evidence`
- `POST /api/v1/enterprise-integrations/:integrationId/adapter-assess`
- `GET /api/v1/enterprise-integrations/:integrationId/adapter-assessments`

All routes require authentication, organisation scope and the declared permission.

## Operational safeguards
- P581 stores saved schedules but does not run a scheduler or deliver report files.
- P582 only assesses provider event contracts; it does not make outbound network calls.
- P583 uses PostgreSQL shared buckets for auth throttling. If the database is unavailable, auth throttling fails closed with HTTP 503.
- Keep payment live mode, provider dispatch and offline alcohol posting disabled.
- Do not use demo seed credentials or weak secrets in production.
