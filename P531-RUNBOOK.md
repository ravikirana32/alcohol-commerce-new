# P531 Runbook — Bar Measures & Open-Bottle Inventory

## Prerequisites

- Node.js 20.18+ and npm 10.8+.
- PostgreSQL configured through the existing API environment.
- A database backup and a deployment window before applying migration 230.
- Organisation/outlet, verified licence, active products, outlet price records, stock balances and open bottles already configured.
- A user with the required `offline:*`, `bar:*`, `peg:*` permissions. Never share tokens or secrets in logs.

## Start locally

```bash
npm install
npm run db:status
npm run db:migrate
npm run dev
```

The workspace scripts start the API and web app. Use the configured API base URL from the environment; do not hardcode production credentials.

## Configure bar prices and open bottles

1. Create/verify active products with correct pack size.
2. Configure `BAR_PEG` prices for each supported `volumeMl` (for example 30, 60, 90 and custom sizes) and configure `BAR_BOTTLE` / `BAR_PACKAGED` prices.
3. Receive bottle stock, then open a bottle using the existing `POST /api/v1/bar/open-bottles` endpoint.
4. Confirm `GET /api/v1/bar/open-bottles?outletId=<uuid>` reports remaining and unreserved millilitres.

## Reserve volume

```http
POST /api/v1/bar/open-bottles/{openBottleId}/reservations
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "outletId": "<outlet-uuid>",
  "volumeMl": 180,
  "expiresAt": "2026-11-09T16:00:00.000Z",
  "reason": "Reserved for table service"
}
```

Expiry must be in the future and within 24 hours. List reservations with `GET /api/v1/bar/bottle-reservations?outletId=<uuid>`. Release an active reservation with `POST /api/v1/bar/bottle-reservations/{reservationId}/release` and a reason. Expired reservations are marked expired when the list is refreshed.

## Record wastage or breakage

Use `POST /api/v1/bar/peg-transactions` with `type` equal to `WASTAGE`, `BREAKAGE`, `COMPLIMENTARY` or `ADJUSTMENT`. The operation deducts the exact volume under a bottle row lock and requires notes. The Bar Service UI exposes the same operation.

## Offline bar posting workflow

1. Enrol the device and submit a bounded sync batch using P525 APIs.
2. Review and approve the event through P526. Do not approve conflicts.
3. Run structural validation (P527).
4. Run authoritative checks (P528). The bar inventory check accounts for active bottle reservations.
5. Obtain an independent P529 posting approval. The approver must differ from all prior actors listed in the approval route.
6. Use the Bar Checkout posting action in Offline Reconciliation. Confirm the irreversible action.
7. Verify the returned bar ticket, peg transaction, stock movement, KOT and posting execution. Offline payment evidence remains `RECORDED_OFFLINE`; it is not a gateway settlement.

## Important payload fields

- `totalMinor` and `unitPriceMinor` are integer paise.
- `quantity` is a positive whole number.
- `lineType` is `PEG`, `BOTTLE` or `PACKAGED`.
- PEG lines require `volumeMl` and `openBottleId`.
- Payment `amountMinor` values must sum exactly to `totalMinor`.

## Recovery and safety

- A `BLOCKED` execution is terminal for that intent; its intent is moved to `HELD` and event to `CONFLICT`. Resolve the issue and submit a new source event. Do not edit the original event or delete its audit trail.
- A successful replay returns the existing execution; it must not create a second ticket or inventory movement.
- A database exception during posting should roll back the entire transaction. Verify with PostgreSQL integration/failure-injection tests before production use.
- Do not treat `RECORDED_OFFLINE` as SETTLED. P535 owns settlement reconciliation.
- Journals/COGS are deferred to P536.

## Verification commands

```bash
npm run verify:p531
npm run verify:p530
npm run verify:migrations
npm run preflight:migrations
npm run check:syntax
npm run typecheck
npm run test --workspace @acp/api
```

A failed typecheck/test must be investigated in an environment with dependencies installed. Static checks alone do not certify the live workflow.
