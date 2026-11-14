# P571 Implementation — Stock Ledger Foundation & Signed Adjustment Direction

Version: `0.571.0-dev`

## Scope
P571 makes adjustment sign explicit for new ledger events and adds immutable opening-stock baselines for reconciliation.

## Changes
- Migration `247_p571_stock_ledger_foundation.sql` adds `stock_movements.adjustment_direction` with `INCREASE` / `DECREASE` values.
- A PostgreSQL `BEFORE INSERT` trigger requires direction for every new `ADJUSTMENT` row while leaving pre-existing legacy rows intact. Existing null-direction rows remain visible as unclassified exceptions.
- `appendStockMovementOnce` includes adjustment direction in the request fingerprint and rejects new adjustment inputs without a direction.
- Manual adjustment and stocktake approval paths pass direction derived from the signed delta.
- Added organisation/outlet-scoped `stock_opening_balance_snapshots` and product-level `stock_opening_balance_lines`.
- Added `POST /inventory/opening-balance-snapshots` (`inventory:adjust`) to capture the current outlet balance as a one-time, reasoned baseline. It does not mutate balances or movement history.
- Reconciliation now computes opening baseline + post-capture movements, including signed adjustment movements. Legacy adjustments without direction are excluded from arithmetic and counted as exceptions.

## API
`POST /api/operations/inventory/opening-balance-snapshots`

```json
{"outletId":"<outlet-uuid>","reason":"Initial verified physical stock baseline"}
```

The endpoint returns `409 OPENING_BASELINE_ALREADY_EXISTS` if a baseline already exists for that organisation/outlet. Baselines are immutable; correction/supersession is not implemented.

## Important operational constraint
The snapshot is a captured balance, not proof of a physical count. Perform and approve a physical count before capturing it. The current implementation locks the outlet row during capture, but a fully consistent point-in-time cutover requires every stock writer to follow compatible outlet/product locking. Runtime concurrency acceptance is still required.
