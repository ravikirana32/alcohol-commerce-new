# P561 Runbook

## Static verification
```bash
npm run verify:p561:static
npm run verify:p561
node scripts/check-typescript-syntax.mjs
python3 scripts/verify-migrations.py
```

## Runtime acceptance still required
1. Use a disposable PostgreSQL database and apply all migrations from a clean state.
2. Seed at least two organisations and two outlets per organisation with separate role accounts.
3. Exercise KOT status, offline recovery triage, finance journal posting, retail refund and shift closure within the owning organisation.
4. Repeat each operation with a foreign organisation's resource ID; expect a not-found/denied response and verify no row changed.
5. Repeat with a same-organisation but unauthorised outlet context.
6. Verify transaction rollback and audit event consistency.
7. Capture database snapshots before and after negative cases.

Do not run destructive tests against production. Keep credentials in environment variables and never commit `.env` files or database dumps.
