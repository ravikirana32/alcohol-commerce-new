# P531 — Bar Measure & Open-Bottle Inventory

**Version:** `0.531.0-dev`  
**Release state:** PARTIAL / developer preview  
**Baseline:** P530 cumulative package

## Objective

Extend the P527–P530 offline event workflow to safely process `BAR_CHECKOUT` events while preserving the retail posting path. Support exact peg-volume depletion, bottle and packaged stock movements, reservations, wastage and breakage. A successful posting must be atomic and idempotent; payment evidence must not be represented as settlement.

## Implemented scope

### 1. Offline bar checkout contract

`BAR_CHECKOUT` events use the existing P525–P529 review chain. The event payload is expected to contain:

```json
{
  "currency": "INR",
  "clientReference": "device-ticket-000123",
  "occurredAt": "2026-11-09T14:00:00.000Z",
  "totalMinor": 22000,
  "items": [
    {"productId":"<uuid>","lineType":"PEG","quantity":2,"volumeMl":60,"openBottleId":"<uuid>","unitPriceMinor":10000},
    {"productId":"<uuid>","lineType":"PACKAGED","quantity":1,"unitPriceMinor":2000}
  ],
  "payments": [{"method":"CASH","amountMinor":22000,"reference":"cash-tender-1"}]
}
```

`PEG` lines require an integer `volumeMl` and outlet/product-scoped `openBottleId`. `BOTTLE` and `PACKAGED` lines require whole stock units and cannot carry peg bottle fields. Payment allocations must be positive, use a supported tender method and sum exactly to `totalMinor`.

### 2. Authoritative validation

P528's authoritative check now validates bar inventory rather than always failing closed:
- organisation and outlet state and the verified licence capability still apply;
- products must be active and organisation-owned;
- each line's current outlet price and peg volume price must match `unitPriceMinor`;
- peg bottle must be open, scoped to the organisation/outlet/product and have sufficient *unreserved* millilitres;
- bottle and packaged lines must have sufficient outlet stock units;
- payment arithmetic must reconcile to the event total.

The posting worker repeats all critical checks under database locks. Authoritative PASS remains evidence, not posting authorisation.

### 3. Transactional posting

`POST /api/v1/offline/posting-intents/:intentId/post` now handles `BAR_CHECKOUT` after P527 structural validation, P528 authoritative PASS and P529 independent approval.

Within one PostgreSQL transaction it:
1. Locks the intent and source event and checks approval/validation evidence.
2. Revalidates the active organisation/outlet, products and effective outlet prices.
3. Aggregates all peg demand by open bottle and all bottle/packaged demand by product.
4. Locks open-bottle and stock rows in deterministic identifier order and checks available unreserved volume/stock before inserting a ticket.
5. Inserts an idempotent `bar_tickets` record using the source event ID and payload hash fingerprint.
6. Decrements open-bottle millilitres and inserts `peg_transactions` with type `SALE` for peg lines.
7. Decrements stock units and inserts `stock_movements` for bottle and packaged lines.
8. Inserts `bar_ticket_lines`, a KOT order and KOT lines.
9. Inserts `bar_payments` with `settlement_status='RECORDED_OFFLINE'`.
10. Writes the immutable offline posting execution, updates intent/event status and writes the audit event.

Any database exception after ticket creation aborts the transaction. A terminal business block is recorded before any ticket or inventory mutation, moves the intent to `HELD` and the source event to `CONFLICT`. Replaying a blocked intent returns a conflict, not a success. Successful replays return the prior execution.

### 4. Measure rules

`apps/api/src/services/barMeasureRules.ts` provides shared integer rules:
- `pegConsumedMl(volumeMl, quantity)`;
- `unreservedBottleMl(remainingMl, reservedMl)`;
- `barLineTaxMinor(unitPriceMinor, quantity, taxRate)`.

Measures are represented as exact integer millilitres, so 30 ml, 60 ml, 90 ml and custom sizes are supported. The current price-book record remains authoritative for each peg volume.

### 5. Reservations

Migration `230_p531_offline_bar_measure_posting.sql` creates `bar_bottle_reservations` with organisation/outlet/bottle/product references, reserved and consumed millilitres, expiry, status and actor evidence.

Endpoints:
- `POST /api/v1/bar/open-bottles/:bottleId/reservations`
- `GET /api/v1/bar/bottle-reservations?outletId=<uuid>`
- `POST /api/v1/bar/bottle-reservations/:reservationId/release`

Reservations expire within a maximum 24-hour window. Reservation creation locks the bottle and ensures requested millilitres do not exceed unreserved volume. Expired reservations are marked `EXPIRED` on list retrieval. Online and offline checkout paths exclude active, unexpired reservations from available volume. A reserved quantity must be released before an unreserved offline sale can consume it; P531 does not silently steal a reservation.

### 6. Wastage and breakage

`POST /api/v1/bar/peg-transactions` now accepts `BREAKAGE` in addition to `WASTAGE`, `COMPLIMENTARY` and `ADJUSTMENT`. Each operation locks the open bottle, checks available volume, decrements exact millilitres and records a peg transaction. The Bar Service workspace exposes reservation, release, wastage and breakage controls.

### 7. Operator UI

- Offline Reconciliation workspace now offers a dedicated confirmation action for approved `BAR_CHECKOUT` intents.
- Bar Service workspace lists open bottles with unreserved millilitres, creates and releases reservations, and records measured wastage/breakage/complimentary/adjustment deductions.
- Retail posting remains available and unchanged in intent.

## Migration

- `apps/api/src/db/230_p531_offline_bar_measure_posting.sql`
- Adds `bar_ticket_id` to offline posting executions and enforces exactly one sale or bar ticket reference for successful executions.
- Adds a payment settlement evidence state to `bar_payments`.
- Adds bottle reservations and indexes.
- Adds `BREAKAGE` to peg transaction types.

Run `npm run db:migrate` after backing up the database and applying the usual deployment controls. PostgreSQL execution was not available in this delivery environment; do not treat static migration checks as a database migration test.

## Explicitly not included

- Payment gateway/acquirer settlement, refund and chargeback automation (P535).
- Double-entry journals, COGS, tax payable and balance-sheet automation (P536).
- Jurisdiction-approved excise/age/sale-time/quantity rules (P533) and final GST/cess rules (P534).
- Native mobile device sync, hardware and printer integration (P538).
- Automated reservation consumption by an offline event. P531 safely protects reserved volume by excluding it from unreserved availability; operators must release a reservation before a separate offline event can consume that volume.
- PostgreSQL runtime, API integration, concurrency/failure-injection, browser E2E and legal/finance acceptance.

## Release decision

PARTIAL / developer preview only. Keep offline posting disabled for production until PostgreSQL integration tests prove atomic rollback, duplicate replay, cross-tenant isolation and stock/bottle concurrency. Legal, tax, finance, security and authorised pilot gates remain mandatory.
