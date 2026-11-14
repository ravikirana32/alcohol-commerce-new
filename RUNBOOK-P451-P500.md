# P500.2 Integration Remediation Runbook

## Prerequisites
- Node.js >=20.18 and npm >=10.8.
- PostgreSQL version aligned with the deployment standard.
- Use a disposable local/staging database first.
- Configure `.env.example` into `.env`; never commit production secrets.

## Install and static verification
```bash
npm install
npm run audit:integration
npm run verify:release-gate
npm run verify:retail-checkout
npm run verify:cumulative
npm run verify:p401-p450
npm run check:syntax
npm run verify:migrations
```

## Runtime verification (required before any pilot)
```bash
npm run typecheck
npm test
npm run build
```
Then start PostgreSQL, apply migrations, start API/web and run API + browser E2E against seeded test data. The current delivery has not completed these steps because workspace dependencies could not be installed in the execution window.

## Database migration
Migration `apps/api/src/db/211_p5002_retail_checkout_fingerprint.sql` adds nullable `retail_sales.request_fingerprint`. Apply the migration before deploying API `0.500.2-dev`:
```bash
npm run db:status
npm run db:migrate
npm run db:status
```
The migration is additive and leaves existing sales intact. Existing sales without fingerprints are reconstructed and backfilled on first matching idempotent replay. Do not edit already-applied migrations; use a forward migration for future schema changes.

## Retail checkout acceptance scenarios
1. A valid licensed/active outlet can sell an active product at the current server price.
2. Client-supplied unit price/tax values cannot override the price book.
3. Mixed tenders must equal the server-calculated total exactly to the paise.
4. Stock is deducted once and the stock movement + sale + tender + audit event commit atomically.
5. Repeating the same request with the same idempotency key returns the original sale.
6. Reusing the key with a different receipt, line, quantity or tender returns HTTP 409.
7. Concurrent checkout cannot reduce stock below zero.
8. A receipt number collision returns HTTP 409 without creating a partial sale.
9. Sale detail is scoped to the authenticated organisation and includes lines, tenders and refunds.
10. A failed/uncertain POS request retries the same body and idempotency key.
11. Retail cart can contain multiple products and checkout commits all lines atomically.

## Release blockers
Do not enable production alcohol transactions until:
- PostgreSQL clean install and upgrade rehearsal pass;
- API integration and browser E2E tests pass;
- full typecheck and production builds pass;
- security and tenant-isolation assessments pass;
- payment/hardware provider certifications are complete;
- Karnataka excise/legal permissions are independently validated for each outlet;
- backup/restore and operational drills pass;
- authorised outlet pilot has written sign-off.

AI remains disabled by default. Consumer alcohol transactions remain disabled unless expressly lawful and licensed.


## P500.4–P501 additional verification

```bash
npm run verify:retail-checkout
npm run verify:shift-workspace
npm run verify:retail-sales
npm run verify:bar-tickets
npm run verify:inventory
npm run verify:p501
```

P501 is an integrated developer preview. The deterministic checks do not replace PostgreSQL, API, browser E2E, security, legal or authorised outlet pilot testing.
