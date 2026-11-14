# P572–P574 Implementation Report

## Baseline and objective
Built cumulatively from P571 (`0.571.0-dev`). These three phases were grouped because runtime consistency, reconciliation integrity and controlled variance correction form one stock-ledger completion stream.

## P572 — Stock snapshot serialization and runtime readiness
- Added migration `248_p572_stock_snapshot_serialization.sql`.
- Added transaction-scoped PostgreSQL advisory locking keyed by organisation and outlet on every stock movement insert.
- Opening stock baseline capture acquires the same lock before reading stock balances and writing snapshot lines. The movement trigger and snapshot use `clock_timestamp()` after lock acquisition so transaction-start timestamps cannot misorder events across a lock wait.
- This establishes a serial boundary: movements committed before the lock are included; subsequent movement transactions wait until the snapshot transaction commits.
- Added `scripts/run-p572-p574-postgres-validation.sh` and a catalog assertion SQL file for use against a disposable PostgreSQL database.

## P573 — Reconciliation cutoff and integrity metadata
- Added migration `249_p573_stock_integrity_constraints.sql`.
- Reconciliation acquires the outlet ledger lock, captures a database cutoff timestamp, and records the opening baseline snapshot ID.
- Ledger collection is bounded by the recorded cutoff, making the run reproducible against a defined ledger boundary.
- Added indexes for balance reconciliation and legacy unsigned adjustment investigation.
- Preserved conservative treatment of historical adjustments without direction; they are flagged and not guessed.

## P574 — Maker-checker variance correction workflow
- Added migration `250_p574_stock_variance_corrections.sql`.
- Added correction request, queue, approval and rejection APIs.
- Request creation is idempotent and records a payload fingerprint; replay with changed payload is rejected.
- Requests do not change stock. Approval requires a different user from the requester.
- Approval locks the outlet ledger scope and product balance, rejects negative resulting stock, writes one signed ADJUSTMENT through `appendStockMovementOnce`, and updates the stock balance in the same transaction.
- Database constraints and trigger enforce reviewer separation and organisation/outlet/product/exception linkage.
- Rejected requests preserve the rejection reason. Approved requests retain movement linkage and audit evidence.

## Remaining known limitations
- PostgreSQL execution and true multi-session concurrency acceptance were not available in this environment.
- Existing historical adjustment signs cannot be reconstructed reliably without source evidence; they remain classified as legacy exceptions.
- Opening snapshots are immutable; a mistaken baseline requires a governed new baseline/re-baseline procedure rather than editing history.
- Variance correction workflow is API/schema-level; business UI screens and role-specific maker-checker UX still require browser E2E/UAT.
- Full regression, Vitest, semantic typecheck, tenant/outlet IDOR and penetration testing remain required.
