# P563 Runbook

## Static verification
From the repository root:

```bash
node scripts/verify-p563-tenant-inventory-procurement.mjs
node scripts/verify-p562-tenant-scoped-reads.mjs
node scripts/verify-p561-tenant-updates.mjs
node scripts/verify-p560-static.mjs
node scripts/check-typescript-syntax.mjs
python3 scripts/verify-migrations.py
```

Or run `npm run verify:p563`.

## Runtime acceptance still required
1. Configure a disposable PostgreSQL database using the project's local environment template.
2. Apply all migrations to a clean database.
3. Seed two organisations and at least two outlets per organisation with distinct products, stock balances, batches, transfers and purchase orders.
4. Authenticate role accounts for both organisations.
5. Verify inventory balance/batch/transfer and procurement endpoints never expose foreign organisation records.
6. Attempt foreign purchase-order line IDs and foreign transfer IDs; assert 404/denial without data changes.
7. Exercise concurrent receipt and transfer posting and verify stock quantities remain consistent.
8. Capture database state before/after denied requests.

Do not enable live payment capture, outbound provider dispatch or offline alcohol posting as part of this phase. Production remains NO-GO until all release gates pass.
