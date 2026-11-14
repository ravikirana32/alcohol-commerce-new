# P568 Runbook — Idempotent Inventory Requests

## Upgrade
1. Back up the database and verify the restore procedure in a non-production environment.
2. Install the repository dependencies with the lockfile (`npm ci`).
3. Configure the normal API environment and PostgreSQL connection.
4. Apply migrations using the project's existing command: `npm run db:migrate --workspace @acp/api`.
5. Confirm migration `244_p568_goods_receipt_request_idempotency.sql` is recorded in `schema_migrations` and its checksum is present.
6. Run `npm run verify:p568` and `npm run check:syntax`.
7. Run the API unit suite and staging concurrency tests before enabling clients.

## Client contract
For these operations, send an `Idempotency-Key` HTTP header:
- `POST /api/inventory/receipts`
- `POST /api/inventory/adjustments`
- open-bottle creation endpoint
- `POST /api/procurement/purchase-orders/:poId/receipts`

Generate a 16–120 character key when the user confirms an operation. Persist it with the pending client command and reuse it for every retry until a definitive response is received. Do not create a new key when retrying after a timeout. A replay can return HTTP 200 with `replayed: true`; a changed payload using the same key returns HTTP 409. A first successful post normally returns HTTP 201.

Example browser/client strategy (pseudocode):

```ts
const command = {
  idempotencyKey: createStableOperationId(),
  payload: receiptPayload,
};
await api.post('/inventory/receipts', command.payload, {
  headers: { 'Idempotency-Key': command.idempotencyKey },
});
```

The same key must be retained across network retries; do not regenerate it inside the retry loop.

## Operational checks
- Review `stock_movements.idempotency_key` and `goods_receipts.idempotency_key` for duplicates (unique indexes should prevent them within organisation/outlet scope).
- Investigate `STOCK_MOVEMENT_IDEMPOTENCY_CONFLICT` and `GOODS_RECEIPT_IDEMPOTENCY_CONFLICT` as client key reuse with a changed payload; do not automatically retry with a new key.
- Confirm balance mutation, source document and movement commit/rollback atomically.
- Do not enable production posting until PostgreSQL concurrency, API E2E, tenant isolation, finance/inventory reconciliation and security acceptance pass.

## Current environment limitations
Docker is unavailable in the build environment. Vitest and API dependencies are not installed. The static checks can be run now, but PostgreSQL, semantic typecheck and browser runtime acceptance require a provisioned development/staging environment.
