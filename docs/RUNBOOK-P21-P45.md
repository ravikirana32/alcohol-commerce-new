# Runbook P21–P45

## Local setup
1. Copy `.env.example` to `.env` and configure PostgreSQL credentials, JWT secrets and web origin.
2. Start services: `docker compose up -d --build`.
3. Install workspace dependencies: `npm install`.
4. Apply migrations: `npm run db:migrate`.
5. Check API health: `curl http://localhost:8080/api/health/live`.
6. Run `bash scripts/verify-local.sh`.

## Safety switches
Keep AI, offline sync and consumer discovery disabled until their acceptance gates pass. Use a non-superuser DB role. Do not use production data in local development.

## Staging and pilot
- Apply migrations to a fresh staging database and a copy upgraded from P20.
- Test organisation and outlet isolation using two separate tenants.
- Run retail and bar flows end-to-end, including open bottle reconciliation and shift close.
- Verify payment/accounting/provider adapters using vendor sandboxes only.
- Complete state-specific excise/legal review for each outlet and business activity.
- Complete penetration testing, backup restore, monitoring and support escalation drills.
- Pilot with limited licensed outlets and explicit rollback criteria.

## Rollback
Take a verified backup before migrations. Prefer forward corrective migrations; do not drop or rewrite transactional ledgers as a rollback strategy. Disable the affected feature flag and stop writes if reconciliation or compliance integrity is uncertain.
