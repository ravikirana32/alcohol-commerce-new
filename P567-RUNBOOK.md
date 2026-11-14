# P567 Runbook

## Verify static workflow adoption
```bash
npm run verify:p567:static
npm run verify:p566:static
npm run verify:p565
```

## Run unit tests
```bash
npm run test:stock-idempotency:p566
```
The current environment previously returned `vitest: Permission denied`; if this persists, repair executable permissions or reinstall workspace dependencies before relying on the test result.

## PostgreSQL validation
Apply migrations to a disposable clean database and an upgraded staging copy:
```bash
npm install
npm run db:migrate
npm run db:status
```
Then exercise duplicate requests for retail, bar, offline, transfers, stocktakes and goods receipts. Verify same key/same payload produces one movement; same key/different payload fails and rolls back the surrounding transaction.

## Outstanding API contracts
Manual stock receipt/adjustment and open-bottle creation need a client-provided idempotency key or a stable source entity before converting their movement inserts. Goods receipt needs request-level idempotency to deduplicate a client retry that creates a fresh receipt record.
