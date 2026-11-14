# P529 — Offline Posting Approval and Maker-Checker Controls

**Version:** 0.529.0-dev  
**Baseline:** P528 cumulative  
**Release status:** PARTIAL / developer preview

## Delivered

- Added migration `apps/api/src/db/228_p529_offline_posting_approval.sql`.
- Added organisation-scoped, immutable `offline_posting_approvals` records.
- Added `POST /api/v1/offline/posting-intents/:intentId/approval`.
- Added `GET /api/v1/offline/posting-approvals`.
- Added a dedicated `offline:posting-approve` permission and read permission.
- Approval requires both structural validation and P528 authoritative validation to have passed.
- Enforced maker-checker separation: the approver must differ from the intent creator, sync-batch submitter, reconciliation reviewer, structural validator and authoritative checker.
- Captured a SHA-256 hash of the payload and validation evidence at approval time.
- Made the approval decision immutable per posting intent.
- Added audit event `POSTING_APPROVAL`.
- Updated the Offline Reconciliation workspace with approval/rejection actions and explicit no-posting status.

## State transitions

- `READY_FOR_POST` + `APPROVE` → `AUTHORIZED_TO_POST`.
- `READY_FOR_POST` + `REJECT` → `HELD`.
- An intent with an existing approval decision cannot be decided again.
- `AUTHORIZED_TO_POST` is an authorisation marker only. No posting worker is implemented in P529.

## Safety boundary

P529 does **not** create a retail sale, bar ticket, payment capture, stock movement, tax entry, excise record or accounting journal. Approval is not legal authorisation to sell alcohol. Consumer alcohol transactions and live payment capture remain disabled pending applicable licences, jurisdiction-specific legal review and production acceptance.

## API examples

`POST /api/v1/offline/posting-intents/{intentId}/approval`

```json
{ "decision": "APPROVE", "reason": "Independent review completed" }
```

Use `REJECT` with a reason of at least eight characters to hold the intent.

`GET /api/v1/offline/posting-approvals` returns the organisation-scoped approval history.

## Verification

- P529 static acceptance: 16 checks.
- TypeScript syntax scan and SQL migration validation are recorded in `P529-STATUS.md`.
- PostgreSQL execution, API integration, browser E2E, cross-organisation IDOR, concurrency and failure-injection tests were not run in this environment.

## Remaining exit gates

1. Execute migration 228 against supported PostgreSQL versions and verify rollback/redeploy behavior.
2. Test maker-checker under concurrent approval attempts and confirm exactly one immutable decision.
3. Test organisation/outlet isolation, role permissions, revoked users and token expiry.
4. Implement an idempotent transactional posting worker/outbox before any ledger mutation.
5. Reconcile sales, payments, inventory and finance journals with rollback and duplicate-replay tests.
6. Complete licence, excise, age, tax/GST/cess and payment-evidence rule validation with qualified local review.
