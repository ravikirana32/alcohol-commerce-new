# P565 — Inventory Ledger Integrity & Stock Movement Reconciliation

## Scope

P565 adds read-only PostgreSQL diagnostics and source-level assertions around stock balance and stock movement persistence. It intentionally does not change live posting semantics or add a uniqueness constraint that could reject legitimate partial/split document movements.

## Deliverables

- `scripts/p565-stock-ledger-reconciliation.sql`: read-only checks for organisation consistency of movement/balance outlet and product references, repeated document references, balance-versus-movement candidates, and batch receipt movement candidates.
- `scripts/verify-p565-stock-ledger.mjs`: 11 static assertions covering schema shape, transaction-local movement writes in selected flows, and diagnostic query safety/limitations.
- Root npm commands `verify:p565:static`, `audit:p565:stock-ledger`, and `verify:p565`.
- Updated version to `0.565.0-dev` and cumulative P513–P565 gap register.

## Important design decisions

1. Diagnostics are SELECT-only. They do not repair or delete records.
2. Repeated references are candidates, not automatic duplicates; partial receipts and split lines may be valid.
3. Balance-versus-movement comparison excludes adjustments and is explicitly non-authoritative without a documented opening-balance cutover.
4. No global unique movement index was introduced because legacy workflows do not yet share a universal idempotency key.
5. No claim is made that all stock-changing paths have been proven complete by the targeted checks.
