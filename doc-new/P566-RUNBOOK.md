# P566 Runbook

## Apply migration
From repository root:
```bash
npm install
npm run db:migrate
```

## Verify
```bash
npm run verify:p566:static
npm run test:stock-idempotency:p566
npm run verify:p566
```

## Caller contract
Call `appendStockMovementOnce(client, input)` only inside the caller's existing PostgreSQL transaction. Generate one deterministic key per source event line, e.g. `goods-receipt:<receipt-id>:line:<line-id>` or `offline-sale:<event-id>:line:<line-index>`. Never reuse a document-level key for multiple lines. A replay with identical payload returns the original movement; same key with changed business payload throws `STOCK_MOVEMENT_IDEMPOTENCY_CONFLICT` and the surrounding transaction must roll back.

The helper appends ledger rows only. The caller remains responsible for balance mutation, source document state, and transaction boundaries.
