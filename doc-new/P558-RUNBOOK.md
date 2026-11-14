# P558 Runbook

From the repository root:

```bash
npm run audit:p558:ownership
npm run verify:p558:static
npm run verify:p558
```

For live acceptance, start a disposable PostgreSQL-backed stack, apply all migrations, seed test identities for each role and at least two organisations with separate outlets, then run the P555 authenticated API matrix and P556 tenant isolation harness. Add route-specific IDs from fixtures; never use production data. Verify foreign-org and foreign-outlet reads/writes return the documented denial/not-found response without disclosing data. Test invitation expiry/replay and logout token revocation. Save sanitized logs and fixture IDs in the acceptance evidence; never record credentials or JWTs.
