# P535 — Payment Provider, Cash Reconciliation & Settlement Lifecycle

**Release:** 0.535.0-dev  
**Baseline:** P534 cumulative 0.534.0-dev  
**Delivery classification:** Backend developer-preview implementation; production acceptance is not established.

## Delivered

1. **Signed provider webhook intake** — exact raw JSON bytes are captured before JSON parsing; provider-specific HMAC SHA-256 signatures are verified with constant-time comparison; missing/invalid signatures are rejected; provider event IDs are idempotent; accepted events are stored as `REVIEW_REQUIRED` evidence. The endpoint does not itself capture, refund, or settle funds.
2. **Tender lifecycle ledger** — organisation/outlet scoped tender allocations with retail/bar source references and states `RECORDED`, `RECORDED_OFFLINE`, `PENDING`, `CONFIRMED`, `FAILED`, `REFUNDED`, `DISPUTED`. Non-cash tenders cannot be directly marked confirmed; settlement matching is the confirmation path. `RECORDED_OFFLINE` is never auto-settled.
3. **Cash denomination evidence** — per-shift denomination and quantity records, actor and timestamp, shift lock and open-shift validation, and shift event audit record.
4. **Settlement batch import** — provider settlement header, gross/fee/net integrity constraint, transaction items, duplicate import protection.
5. **Settlement matching** — provider + provider transaction ID + exact amount matching; unmatched, duplicate and amount mismatch cases remain exceptions; eligible pending tender is confirmed only on a unique exact match.
6. **Bank payout confirmation** — only fully matched settlement batches can be confirmed; net payout amount must match to within ₹0.01; mismatches create a high-severity exception.
7. **Exception queue and maker-authorized resolution** — open exception listing and explicit resolution reason/audit fields.
8. **Version and migration** — version advanced to 0.535.0-dev; migration 237 adds provider event, tender allocation, cash count, settlement and exception ledgers.

## API surface

- `POST /api/v1/payments/provider-webhooks/:provider` — public signed raw-body intake; secret env var name is `PAYMENT_WEBHOOK_SECRET_<PROVIDER>`.
- `POST /api/v1/payments/tender-allocations`
- `POST /api/v1/shifts/:shiftId/cash-counts`
- `GET /api/v1/payments/provider-events`
- `POST /api/v1/payments/settlements`
- `POST /api/v1/payments/settlements/:batchId/match`
- `POST /api/v1/payments/settlements/:batchId/bank-confirm`
- `GET /api/v1/payments/exceptions`
- `POST /api/v1/payments/exceptions/:exceptionId/resolve`

## Deliberate controls / boundaries

- No live payment capture, provider credential storage, payout initiation, automatic refund execution, or production provider adapter certification is included.
- Provider webhook payloads are retained as verified evidence but require a provider-specific event-to-payment mapping and reconciliation before financial state changes.
- Tender allocation creation is a controlled operational ledger; it is not yet automatically emitted by every retail/bar checkout payment path. This integration remains open.
- Cash denomination evidence is captured but automated expected-vs-counted cash closing and variance approval workflow remain open.
- Existing P520 statement reconciliation remains in place; P535 settlement batch matching is additive and should be reconciled with the legacy import path before rollout.
- Refund tender allocation, split-tender proportional refund routing, chargeback lifecycle, provider MDR fee reconciliation across partial batches, and automated bank statement ingestion remain open.
- P536 remains responsible for automatic double-entry journals, tax payable, COGS, fee accounting and settlement-to-ledger posting.
- P534 legal/tax and PostgreSQL runtime acceptance blockers remain carried forward.

## Required configuration

Set one secret per provider in the deployment secret manager, for example `PAYMENT_WEBHOOK_SECRET_RAZORPAY`. Do not commit secrets to `.env.example`, source control, or database rows. Provider must send `x-provider-signature` or `x-signature` as hex SHA-256 HMAC, optionally prefixed with `sha256=`. Provider-specific signature formats/adapters must be validated before enabling the callback in a live environment.
