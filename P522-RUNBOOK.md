# P522 Runbook

## API usage
All endpoints require a valid authenticated organisation-scoped session with `finance:view`.

Example:
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "$API_BASE/api/v1/reports/overview?from=2026-01-01&to=2026-01-31"
```

Optional outlet filter:
```text
&outletId=<outlet UUID>
```

## Verification
```bash
npm run verify:p522
npm run check:syntax
npm run verify:migrations
```

Then run the cumulative phase verifiers listed in the root `package.json`.

## Required runtime acceptance before relying on reports
1. Apply all migrations to a disposable PostgreSQL database.
2. Run each endpoint for two organisations and prove no cross-tenant leakage.
3. Test date boundaries, timezone boundary records, empty date ranges and outlet filters.
4. Reconcile overview totals against source retail sales, paid bar tickets, stock movements and purchase orders.
5. Reconcile P&L against posted journal lines and confirm it is explicitly incomplete until automatic postings are enabled.
6. Add indexes based on EXPLAIN ANALYZE and load-test large date ranges.
7. Add browser dashboard, export and accessibility acceptance before declaring the reporting feature complete.

Do not treat gross POS totals as statutory revenue or the P&L as complete financial reporting.
