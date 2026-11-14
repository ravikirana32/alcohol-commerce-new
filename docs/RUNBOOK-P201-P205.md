# Engineering runbook — P201 to P205

## Local development
1. Use Node.js 22 and npm 10 or compatible versions.
2. Copy `.env.example` to `.env` and use development-only credentials.
3. Use a disposable PostgreSQL database; never use live outlet data.
4. Run `npm install`, `npm run typecheck`, `npm run build` and `npm test`.
5. Run `npm run db:migrate` only after reviewing the migration chain and confirming the target database is disposable.
6. For the web app, set `VITE_API_BASE_URL` to the API origin.

## Price setup
An organisation manager with `catalogue:manage` can configure an outlet price using:
`POST /api/v1/outlets/:outletId/prices`
with `productId`, `channel` (`RETAIL`, `BAR_BOTTLE`, `BAR_PACKAGED`, `BAR_PEG`), `unitPrice`, `taxRate`, and `volumeMl` for `BAR_PEG`.
Use `GET /api/v1/outlets/:outletId/prices` to inspect active prices.

## Bar checkout
Use `POST /api/v1/bar/checkout`. The request includes outlet, idempotency key, ticket number, lines and payments. Peg lines require `volumeMl` and `openBottleId`. Server-side pricing is selected by channel and peg volume. Ticket, payments, stock and peg deductions commit in one database transaction.

## Operational restrictions
- Retail sale requires an ACTIVE outlet, RETAIL_ONLY/HYBRID mode and a current VERIFIED licence containing `RETAIL_SALE`.
- Bar service requires an ACTIVE outlet, BAR_ONLY/HYBRID mode and a current VERIFIED licence containing `BAR_SERVICE`.
- Capability names are software policy keys and must be mapped to verified local licence terms by qualified professionals.
- Keep AI, offline sync, consumer discovery, live notifications and external payment execution disabled until separately implemented and validated.
