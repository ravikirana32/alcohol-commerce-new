# P565 Runbook

## Prerequisites

- Use a disposable or staging PostgreSQL database, not production.
- Ensure the schema migrations are applied.
- Set `DATABASE_URL` in the shell; do not commit credentials.
- Install project dependencies if using the npm scripts.

## Static verification

```bash
npm run verify:p565:static
npm run verify:p564
npm run check:syntax
npm run verify:migrations
```

## Read-only ledger diagnostics

```bash
npm run audit:p565:stock-ledger
```

This runs `scripts/p565-stock-ledger-reconciliation.sql` using `psql`. It contains SELECT statements only. Review all results; do not automatically classify repeated references or balance deltas as defects.

## Interpretation cautions

- Movement/balance organisation mismatches are high-priority integrity findings.
- Repeated movement references need document-level review; split/partial events may be legitimate.
- Balance-to-ledger comparison is not authoritative until opening balances are recorded as a cutover baseline and adjustment sign semantics are normalized.
- Batch-to-movement linking is a candidate check, not a guaranteed one-to-one invariant for legacy data.

## Production gate

Do not enable live posting or mark production ready based on static checks. Complete PostgreSQL fixtures, concurrency/retry tests, authenticated tenant/outlet tests, browser acceptance, restore drills and independent security review first.
