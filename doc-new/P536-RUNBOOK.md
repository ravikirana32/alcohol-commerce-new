# P536 Developer Preview Runbook

1. Use the P536 cumulative archive and configure the same PostgreSQL connection used by the existing platform.
2. Configure `DATABASE_URL` and other environment values from the existing deployment runbook. Do not add provider or database secrets to source control.
3. Install workspace dependencies using the repository's supported Node/npm versions.
4. Run migrations with `npm run db:migrate` from the repository root. Migration 238 creates P536 mapping, posting, period and immutability controls.
5. Start API and web workspaces using the existing root scripts (`npm run dev`).
6. Sign in with a user that has `finance:view` and `finance:manage`; period closing additionally requires `finance:period:close`.
7. Create finance accounts first, then configure event mappings in **Finance & Accounting**.
8. Test source posting only with synthetic, reviewed amounts in a non-production database. Use unique source IDs and confirm exact retries are idempotent.
9. Create an accounting period and test that postings inside a closed period return `ACCOUNTING_PERIOD_CLOSED`.
10. Do not use live payment capture, statutory tax filing or production accounting until P534/P535 runtime, legal and accountant gates have passed.

Rollback: do not edit or delete an applied migration. Restore a verified database backup or prepare a separately reviewed forward migration; posted journals are intentionally immutable.
