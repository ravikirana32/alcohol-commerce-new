# P530 — Transactional Offline Retail Posting

**Version:** 0.530.0-dev  
**Release status:** PARTIAL — controlled developer preview; not production approved.

## Delivered
- Added a tenant/outlet-scoped posting execution record with unique constraints on posting intent and source event.
- Added an authenticated, permission-gated posting endpoint. It requires P529 independent approval plus P527 structural PASS and P528 authoritative PASS evidence.
- Executes retail sale creation, sale lines, offline payment evidence, stock balance decrement, stock movement, intent/event state transition and audit record inside one PostgreSQL transaction.
- Locks outlet, posting intent/event and each stock balance; guarded stock decrement prevents oversell if stock changes during execution.
- Uses the source event ID as the sale idempotency key. A retry returns the existing sale instead of creating a duplicate.
- Re-checks current active outlet/organisation, product, outlet price, payment allocation and stock at posting time.
- Persists immutable POSTED/BLOCKED execution evidence and provides a read endpoint.
- Explicitly blocks BAR_CHECKOUT pending P531 measure-aware bottle depletion.
- Offline tender rows are recorded as `RECORDED_OFFLINE`; sale payment status remains `PENDING`. No claim of provider settlement/capture is made.
- Extended the Offline Reconciliation operator UI with a confirmation-gated retail posting action and an explicit disabled state for bar checkout.

## Deliberate limits
- This phase posts retail sale and stock records only. Automatic double-entry journal creation, COGS and tax-account mapping remain open for P536. Response explicitly identifies journal as deferred.
- No live payment gateway capture is performed.
- No bar sale, peg, open bottle or bottle depletion is performed.
- P530 code is feature/permission gated but should remain disabled operationally until clean PostgreSQL integration and financial acceptance tests pass.

## API
- `POST /api/v1/offline/posting-intents/:intentId/post` — requires `offline:ledger-post`.
- `GET /api/v1/offline/posting-executions` — requires `offline:ledger-read`.

## Transaction guarantees
A successful request commits sale header, sale lines, stock balance reductions, stock movements, offline payment evidence, posting execution, intent/event status and audit together. Any thrown database error rolls back the transaction. A duplicate request is resolved through the unique execution row and sale idempotency key.

## Verification status
Static syntax and migration checks are recorded in `P530-TEST-REPORT.md`. PostgreSQL migration execution, multi-session stock race tests, API integration, browser E2E, crash/retry injection, tenant IDOR and journal reconciliation have not been run in this environment. Therefore this is not evidence that every live flow works.
