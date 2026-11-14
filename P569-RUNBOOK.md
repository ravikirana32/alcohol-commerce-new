# P569 Runbook Addendum

## Apply migration

From the repository root, configure the API database environment, then run:

```bash
npm run db:migrate --workspace @acp/api
```

Confirm migration `245_p569_refund_request_idempotency.sql` is recorded as applied before testing refunds.

## Refund client requests

Add an `Idempotency-Key` header to both retail and bar refund POST requests. Generate a unique key for each new refund operation, persist it client-side while the request is pending, and reuse it unchanged for retries. Never reuse a key for a different refund payload.

## Static verification

```bash
npm run verify:p569
npm run check:syntax
python3 scripts/verify-migrations.py
```

## Runtime acceptance still required

Use disposable PostgreSQL fixtures to test: same key/same payload sequential replay; same key/same payload concurrent replay; same key/changed payload conflict; different keys for partial refunds; retail restock balance + movement atomicity; bar peg quarantine replay; transfer dispatch/receipt replay; rollback on injected failure; cross-organisation/outlet denial. Do not enable production refunds or restock based only on static verification.
