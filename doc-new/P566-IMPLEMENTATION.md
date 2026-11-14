# P566 — Inventory Movement Idempotency & Retry-Safe Posting

## Scope
Introduces a source-event-line idempotency identity for `stock_movements`. The key is scoped to `(organisation_id, outlet_id)` and stores a SHA-256 fingerprint of the movement's business fields.

## Changes
- Migration `243_p566_stock_movement_idempotency.sql` adds nullable `idempotency_key` and `request_fingerprint` columns, shape checks, a partial unique index and a scoped reference index.
- `appendStockMovementOnce` performs an insert-once operation, returns the original movement for an identical replay, and rejects reuse of a key with different payload.
- The helper is append-only and deliberately does not mutate `stock_balances`; callers must invoke it inside the same transaction as the source document and balance update.
- Unit tests cover stable fingerprinting, first insert, identical replay, payload conflict and invalid inputs.

## Important integration boundary
Existing retail, bar, transfer, receipt, refund and offline workflows are not all migrated to call this helper in P566. The helper and schema are available, but end-to-end adoption must be completed workflow by workflow. Do not claim global retry safety yet.
