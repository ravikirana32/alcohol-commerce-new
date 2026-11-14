# P568 — Complete Stock Movement Idempotency & Concurrency Protection

## Scope
P568 closes the P567 gaps for manual stock receipt, manual stock adjustment, open-bottle opening and goods-receipt request replay. It extends P566 movement-level append-once protection to the balance/source-document mutations in these routes.

## Implementation

1. **Manual stock receipt** (`POST /inventory/receipts`)
   - Requires `Idempotency-Key` header (16–120 characters; `[A-Za-z0-9._:-]`, first character alphanumeric).
   - Uses `manual-receipt:<key>` with `appendStockMovementOnce`.
   - Increments `stock_balances` only when the movement is newly created.
   - Identical replay returns the original movement and current balance with HTTP 200 and `replayed: true`; changed payload under the same scoped key conflicts through the movement fingerprint.
2. **Manual stock adjustment** (`POST /inventory/adjustments`)
   - Requires the same header contract and uses `manual-adjustment:<key>`.
   - Signed delta is included in the fingerprint notes, preventing positive/negative adjustments with the same absolute quantity from being treated as identical.
   - Movement append and balance mutation share one transaction; replay returns before applying the delta again.
3. **Open bottle** (the existing open-bottle creation route)
   - Requires the same header contract and uses `open-bottle:<key>`.
   - The movement is appended in the transaction; stock is debited and the bottle row created only for the first request.
   - Replay resolves the original bottle by `source_movement_id`; an inconsistent missing bottle returns 409.
4. **Goods receipt** (`POST /procurement/purchase-orders/:poId/receipts`)
   - Requires the same header contract.
   - Migration 244 adds nullable `idempotency_key` and `request_fingerprint` to `goods_receipts`, with an organisation/outlet-scoped partial unique index.
   - The SHA-256 fingerprint covers the purchase-order ID and validated receipt payload.
   - The purchase-order row is locked before checking the key. Identical replay returns the original receipt with HTTP 200 before receipt lines, PO received quantities, stock balances, batches or stock movements can be mutated again. Changed payload returns 409.
5. Updated P565 static verification to recognise append-once movement helper usage in manual receipt/adjustment paths rather than expecting direct SQL inserts.

## API compatibility
The three manual inventory/open-bottle endpoints and goods receipt endpoint now require an `Idempotency-Key` header. Clients must generate one key per user-initiated operation and reuse that same key for retries. Do not generate a new key for a retry. Keys are scoped to organisation and outlet by the underlying movement/receipt constraints.

Example:

```http
POST /api/inventory/receipts
Idempotency-Key: receipt-ui-20261110-00000001
Content-Type: application/json
```

## Files changed
- `apps/api/src/routes/operations.ts`
- `apps/api/src/routes/procurement.ts`
- `apps/api/src/db/244_p568_goods_receipt_request_idempotency.sql`
- `scripts/verify-p565-stock-ledger.mjs`
- `scripts/verify-p567-stock-workflow-adoption.mjs`
- `scripts/verify-p568-stock-request-idempotency.mjs`
- Root and API package version/scripts.

## Verification
- P568 static assertions: 10/10 PASS.
- P567 workflow adoption: 10/10 PASS.
- P566 idempotency helper: 10/10 PASS.
- P565 stock ledger: 11/11 PASS.
- P564 tenant mutation: 14/14 PASS.
- TypeScript syntax transpilation: 274 files, 0 diagnostics.
- SQL migration static validation: 244 ordered migrations PASS.
- Runtime/unit tests: NOT RUN — Vitest is not installed in the workspace (`vitest: not found`).
- Typecheck: BLOCKED — workspace dependencies/types are not installed (`express`, `@types/node`, etc. missing).
- PostgreSQL and concurrency tests: NOT RUN — Docker is not installed in this environment.

## Remaining risks
- Runtime transaction/concurrency behaviour must be proven against PostgreSQL, including two simultaneous requests with the same key and same/different payload.
- The Idempotency-Key header contract is a client integration change; update all web/POS clients to generate and persist a key across retries.
- Goods-receipt idempotency serialises requests on the purchase-order row; verify high-volume contention and deadlock behaviour in staging.
- Manual receipt/adjustment/open-bottle keys share the stock-movement key namespace per organisation/outlet. Client key generation must avoid reuse across operations; prefixes separate endpoint namespaces.
- Refund return movements in `settlements.ts` and the legacy `ecosystem.ts` stock movement paths still need a dedicated audit for source request idempotency and balance mutation coupling.
- Tenant/outlet IDOR, browser E2E, penetration, PostgreSQL clean install/upgrade and load/failover acceptance remain open.

**Release decision: NO-GO for production.** P568 improves source-level retry safety but has not passed runtime concurrency, database or end-to-end acceptance.
