# P569 — Refund Idempotency & Stock-Write Audit

Version: `0.569.0-dev`  
Baseline: P568 cumulative ZIP  
Status: source changes and static verification complete; runtime acceptance remains open.

## Delivered

1. Added migration `245_p569_refund_request_idempotency.sql` with nullable request key and SHA-256 fingerprint columns on `retail_refunds` and `bar_refunds` plus organisation/outlet-scoped partial unique indexes. Existing refund rows remain valid with NULL keys.
2. Retail and bar refund endpoints require `Idempotency-Key` (16–120 permitted characters). Clients must reuse the same key on a retry. The canonical payload fingerprint includes the sale/ticket identifier and validated refund payload.
3. Refund replay is checked while the parent sale/ticket is locked and before refund, restock, peg-quarantine or status mutations. Identical replay returns the original refund with HTTP 200; payload mismatch returns HTTP 409.
4. Retail refund restock ledger movements now use `appendStockMovementOnce` in the same transaction as the refund and stock-balance update.
5. Outlet-transfer dispatch and receipt movements now use stable transfer-line identities through `appendStockMovementOnce`.
6. Updated the P565 static assertion to recognize the centralized append-once helper after refund restock migration.
7. Added `scripts/verify-p569-refund-idempotency.mjs` and npm scripts `verify:p569:static` / `verify:p569`.

## Stock-write audit

Static search across `apps/api/src` finds direct `INSERT INTO stock_movements` only inside `services/stockMovementIdempotency.ts`. This is a source-level inventory, not proof that all stock mutations are transactionally correct at runtime. `stock_balances` writes must remain in the same database transaction as their movement and source-document mutation.

## Client contract

For both `POST /retail/sales/:saleId/refunds` and `POST /bar/tickets/:ticketId/refunds`, send a 16–120 character `Idempotency-Key`. Reuse the exact same key and payload for transport retries. A changed payload with an existing key receives `409 IDEMPOTENCY_KEY_CONFLICT`. Do not generate a fresh key for a retry of the same business operation.
