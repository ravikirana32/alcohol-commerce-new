# P560 Runbook

From the repository root:

```bash
npm run audit:p560:sql
npm run verify:p560:static
npm run verify:p560
```

The audit reads `../reports/P559-SQL-TENANT-PREDICATE-AUDIT.json` and SQL migration files under `apps/api/src/db`; it writes `../reports/P560-SQL-TRIAGE.json` and `P560-SQL-TRIAGE.md`.

Before runtime acceptance, use a disposable PostgreSQL database with representative organisations, outlets, parent/child resources and seeded role accounts. Execute authenticated positive and negative requests for each candidate query path. Never run destructive mutation tests against production data. The static audit is a triage aid, not a security certification.
