# P526 — Offline Reconciliation and Maker-Checker

Version: `0.526.0-dev`  
Release: **PARTIAL — developer preview**

## Delivered

- Added migration `225_p526_offline_reconciliation.sql` with submitter identity, reviewer identity/time/reason, review-queue index and `offline:review` role permissions.
- Offline batch intake records the submitting user on the batch.
- Added organisation-scoped event review queue API: `GET /api/v1/offline/reconciliation/events` with status and batch filters.
- Added decision API: `POST /api/v1/offline/reconciliation/events/:eventId/decision`.
- Maker-checker rule rejects a decision by the user who submitted the batch.
- Decisions require a reason (8–500 chars), lock the event/batch in a transaction, record reviewer/time/reason and append an audit event.
- Conflicts, duplicates and already-decided events cannot be approved through this route; conflicts remain visible for investigation.
- Approval status is `APPROVED_NO_POST`; no sale, payment, stock movement or accounting journal is created.
- Added an authenticated operator review workspace with awaiting-review, conflict, approved-not-posted and rejected queues.

## API contract

- `GET /api/v1/offline/reconciliation/events?status=REVIEW_REQUIRED&batchId=<uuid>`
- `POST /api/v1/offline/reconciliation/events/:eventId/decision`
  - body: `{ "decision": "APPROVE" | "REJECT", "reason": "..." }`

## Deliberate safety boundary

P526 adds an approval record only. `APPROVED_NO_POST` must not be interpreted as a completed sale or stock movement. Financial posting remains disabled. There is no automatic promotion to POS, tender, inventory or accounting ledgers.

## Remaining limitations

- PostgreSQL runtime migration and API integration tests not executed in this delivery environment.
- No complete event schema validation against current product, price, licence, tax, stock and tender state.
- No ledger posting, settlement matching, reversal or financial reconciliation workflow.
- Conflicts require a separate investigation/resolution policy.
- No immutable external audit export, signed reviewer authentication, MFA step-up or time-bound approval delegation.
- No Playwright E2E, cross-tenant IDOR suite, concurrency test or penetration test executed.
- UI visibility relies on API permissions; end-to-end role matrix still requires runtime verification.

## Verification

Static source checks and migration ordering validation are recorded in `P526-STATUS.md`. These do not establish runtime correctness or production readiness.
