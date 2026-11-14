# P571 Runbook

## Upgrade
1. Back up the database and verify the backup can be restored in a disposable environment.
2. Deploy the P571 code and run the normal migration command: `npm run db:migrate --workspace @acp/api`.
3. Verify migration `247_p571_stock_ledger_foundation.sql` is recorded in `schema_migrations` and checksum table.
4. Run static checks: `npm run verify:p571` (requires workspace dependencies for npm orchestration; alternatively run `node scripts/verify-p571-stock-ledger-foundation.mjs` and the phase verifier scripts directly).

## Opening baseline procedure
1. Complete a physical stock count and resolve count discrepancies through the approved stocktake workflow.
2. Confirm the outlet has no in-flight receiving, checkout, transfer, refund or stocktake posting activity.
3. Use an authorised inventory-adjust user to call `POST /api/operations/inventory/opening-balance-snapshots` with outlet ID and a reason.
4. Verify the returned snapshot ID and captured time; then run `POST /api/operations/inventory/reconciliation-runs` for that outlet.
5. Investigate all exceptions. Do not use a baseline to conceal unresolved ledger variances.

## Adjustment writers
All new `ADJUSTMENT` movement inserts must specify `adjustment_direction` as `INCREASE` or `DECREASE`. Use `appendStockMovementOnce` for application writes and keep the movement insert and stock balance mutation in the same transaction. Legacy null-direction rows are retained and reported as unclassified.

## Safety
The baseline is immutable and one-time per organisation/outlet. No automated stock correction is performed. Do not enable production use until PostgreSQL runtime, concurrent-write consistency, authenticated API, tenant isolation and finance/operations acceptance are complete.
