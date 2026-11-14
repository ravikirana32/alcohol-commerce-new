# P04–P10 implementation guide

This cumulative codebase adds the first operational vertical slice after the P03 identity foundation.

## P04 — Organisations, outlets and licences
- Organisation creation/listing; outlet creation/listing; licence evidence metadata submission and review.
- Licence verification is a privileged platform-admin workflow.
- Operating profile is not proof of legal permission. Outlet activation and regulated capabilities must be controlled by verified, current licence data and jurisdiction-specific rules.
- Evidence is stored as a URI only. Upload storage, malware scanning, retention policy and reviewer workflow UI remain future work.

## P05 — Product catalogue
- Organisation-scoped product create, list/search and basic update/archive.
- Product pack size is stored in millilitres; SKU uniqueness is per organisation.
- Category table exists; category CRUD, barcode hardware integration, tax-rule engine and bulk import/export remain future work.

## P06 — Procurement and inventory
- Receipt and adjustment endpoints update stock balances and append immutable movement records.
- Supplier, purchase-order, stock-count tables are included.
- PO lifecycle, supplier invoice matching, transfer approval, count approval and negative-stock policy UI remain future work.
- Inventory quantity is expressed in sellable units; peg volume is tracked separately in ml.

## P07 — Retail POS
- Transactional checkout validates active outlet, product, available stock and tender total.
- Checkout uses an idempotency key and writes sale, lines, payment and stock movement in one DB transaction.
- Offline queue/sync, receipt rendering, returns/void approvals, discount/tax configuration, barcode device integration and payment gateway settlement are not implemented yet.
- Never retry a checkout with a new idempotency key if the first response is uncertain.

## P08 — Peg inventory engine
- Opening a bottle transfers one full unit from packaged stock into an open-bottle record.
- Peg/wastage/complimentary/adjustment events deduct exact ml under a row lock.
- Measures are configurable through `peg_measures` (seed/admin endpoints and UI still needed).
- Peg transaction is deliberately separate from ticket creation: a production implementation must make ticket + peg consumption atomic in one workflow and support reversals/authorisation.
- Bottle emptying, variance investigation, yield rules and partial-bottle valuation remain to be completed.

## P09 — Bar POS
- Creates bar tickets and lines; accepts split tender payments; computes paid balance and ticket state.
- Peg lines can reference an open bottle, but ticket creation does not itself consume ml yet. Integrate peg deduction atomically before pilot.
- Table map, seat/course management, ticket split/merge, happy-hour pricing, kitchen/bar display, service charge and void controls remain future work.

## P10 — Shifts and reconciliation
- Shift open, preview and close endpoints.
- Cash expected is calculated from opening float plus cash tender captured by retail and bar payments since shift start.
- Declared cash and variance are persisted with a shift event.
- Non-cash settlement reconciliation, refunds, cash drops, paid-outs, multi-terminal attribution, supervisor approval, reopen workflow and audit export remain future work.

## API base
All operations below require `Authorization: Bearer <accessToken>` and an active organisation context, except platform-admin organisation management. The organisation scope is derived from the signed token, not a client-supplied organisation ID.

- `POST/GET /api/v1/organisations`, `POST /api/v1/organisations/:organisationId/members` (platform-admin initial provisioning)
- `POST/GET /api/v1/outlets`, `POST /api/v1/outlets/:outletId/status` (platform-admin activation)
- `POST /api/v1/outlets/:outletId/licences`
- `POST /api/v1/licences/:licenceId/review` (platform admin)
- `POST/GET/PATCH /api/v1/catalogue/products`
- `POST /api/v1/inventory/receipts`, `GET /api/v1/inventory/balances`, `POST /api/v1/inventory/adjustments`
- `POST/GET /api/v1/retail/sales`
- `POST/GET /api/v1/bar/open-bottles`, `POST /api/v1/bar/peg-transactions`
- `POST /api/v1/bar/tickets`, `POST /api/v1/bar/tickets/:ticketId/payments`
- `POST /api/v1/shifts/open`, `GET /api/v1/shifts/:shiftId/preview`, `POST /api/v1/shifts/:shiftId/close`

## Migration sequence
`npm run db:migrate` applies `001` through `010` in filename order. Apply to a disposable development database first and back it up before any shared environment migration.

## Important security and correctness gaps before pilot
- Complete tenant isolation review and add PostgreSQL RLS or equivalent, plus cross-tenant negative tests.
- Add outlet-level access checks (current middleware scopes to organisation, not individual outlet assignments).
- Add rate limiting, MFA, password reset, secure HttpOnly cookie/BFF strategy, CSRF protection and session refresh/rotation.
- Add permission seeds for every role and review least privilege.
- Add domain-level licence capability checks to all regulated sales endpoints; current code does not yet enforce licence activity/expiry for every transaction.
- Add automated tests for concurrency, retries, duplicate payment webhooks, stock oversell, peg depletion, refunds and shift boundary conditions.
- Add offline IndexedDB queue, conflict resolution and signed sync/idempotency strategy.
- Configure tax, pricing and excise registers only after qualified jurisdiction-specific review.

## Validation status
Source scaffolding has been generated. The prior P03 dependency installation attempt timed out. No claim is made that these phases have passed TypeScript compilation, migrations, integration tests, browser tests, load tests or legal validation. Treat as developer preview, not production-ready software.
