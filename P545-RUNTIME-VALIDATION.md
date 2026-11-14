# P545 Runtime Validation Runbook

1. Use a disposable or approved staging environment; back up PostgreSQL and verify restore before schema changes.
2. Copy `.env.docker.example` to `.env`; set unique high-entropy `POSTGRES_PASSWORD`, `JWT_SECRET` and `BOOTSTRAP_SECRET`. Keep payment/offline/AI/notification live flags disabled.
3. Run `npm run verify:p545` and `npm run verify:p544:env`.
4. Run `npm run runtime:p545`. The runner validates Compose, starts the stack, captures health/log evidence, checks PostgreSQL and executes API/web smoke probes and migration status.
5. Review `artifacts/p545-runtime/` and resolve all failures. Verify migration count and application behavior against a known baseline.
6. Execute authenticated retail sale/refund, bar ticket/KOT, stock receipt/adjustment, shift close, settlement and accounting reconciliation journeys with approved test fixtures.
7. Execute tenant isolation, RBAC negative tests, backup/restore and performance tests before any release decision.

The runner never removes persistent volumes. Do not use production data for exploratory testing. If migration fails, stop deployment, preserve logs and follow `P545-ROLLBACK.md`; do not blindly reverse migrations.
