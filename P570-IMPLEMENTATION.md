# P570 — Stock Ledger Reconciliation & Integrity Exceptions

Version: `0.570.0-dev`  
Baseline: P569 cumulative ZIP  
Status: source implementation and static checks complete; PostgreSQL/runtime acceptance remains open.

## Delivered

1. Added migration `246_p570_stock_reconciliation.sql` with organisation/outlet-scoped reconciliation run and exception tables.
2. Added `collectStockReconciliation()` service to compare active product balances against classified stock movement totals.
3. Added `POST /api/v1/inventory/reconciliation-runs` to create an immutable run snapshot and findings.
4. Added run history and exception listing endpoints, plus controlled exception status updates (`INVESTIGATING`, `RESOLVED`, `ACCEPTED`) with resolution notes.
5. Findings include balance/ledger variance, missing balance row, negative balance, and unclassified adjustment movement.
6. Added `scripts/verify-p570-stock-reconciliation.mjs` and npm scripts `verify:p570:static` / `verify:p570`.

## Important accounting/inventory limitation

The existing `ADJUSTMENT` stock movement model stores a positive quantity but does not persist whether the adjustment was an increase or decrease. P570 deliberately excludes adjustment quantities from the arithmetic and surfaces them as `UNCLASSIFIED_ADJUSTMENT`; it does not guess their sign. Similarly, this first pass does not infer an opening balance for stock predating the ledger baseline. A variance is therefore an investigation signal, not proof of a ledger error.

## Safety model

Reconciliation is read-only with respect to `stock_balances` and `stock_movements`. It never auto-corrects stock. Resolution status is an investigation workflow only; correcting inventory must use the normal approved stock adjustment process and an idempotency key.

## API

- `POST /api/v1/inventory/reconciliation-runs` — `{ outletId, notes? }`
- `GET /api/v1/inventory/reconciliation-runs?outletId=...`
- `GET /api/v1/inventory/reconciliation-exceptions?outletId=...&status=OPEN|INVESTIGATING|RESOLVED|ACCEPTED|ALL`
- `POST /api/v1/inventory/reconciliation-exceptions/:exceptionId/status` — `{ status, notes }`

Read/list/run operations require `inventory:read`; exception status changes require `inventory:adjust`. All reads and writes are organisation-scoped; run creation verifies the outlet belongs to the authenticated organisation.
