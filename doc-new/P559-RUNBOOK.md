# P559 Runbook

## Generate the audit

```bash
npm run audit:p559:sql
npm run verify:p559:static
```

Review `P559-SQL-TENANT-PREDICATE-AUDIT.md` and the complete machine-readable `../reports/P559-SQL-TENANT-PREDICATE-AUDIT.json`. Each candidate must be triaged in source context; do not bulk-add tenant predicates without understanding joins, parent ownership and global reference data.

## Runtime acceptance (required before release)

1. Use a disposable PostgreSQL database with at least two organisations and two outlets each.
2. Seed separate users with valid role grants and outlet assignments.
3. Exercise reads, writes, nested-resource lookups, reports, exports and background jobs with own-tenant and foreign-tenant identifiers.
4. Assert foreign resources return the documented denial/not-found response and produce no mutation or data leakage.
5. Capture sanitized SQL/log evidence and run the complete P553–P559 verification suite.

Never run destructive IDOR tests against production data. Live payment capture, provider dispatch and offline alcohol posting remain disabled pending separate acceptance.
