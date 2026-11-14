# P526 Runbook — Offline Reconciliation

## Prerequisites

- P525 cumulative environment and PostgreSQL database.
- Apply migrations in order through `225_p526_offline_reconciliation.sql` using the existing migration runner.
- API and web dependencies installed from the lockfile.
- Authenticated reviewer account with `offline:read` and `offline:review` permissions.

## Review workflow

1. Sign in as an authorised reviewer and open **Offline Reconciliation**.
2. Select **Awaiting review** and refresh the queue.
3. Inspect event type, payload, device/batch IDs and received time.
4. Enter a reason of at least eight characters.
5. Approve or reject. The API prevents the batch submitter from reviewing their own batch.
6. Review conflicts separately; this workflow intentionally does not approve conflict rows.
7. Confirm the result in the queue and audit records.

## API examples

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "$API_BASE/api/v1/offline/reconciliation/events?status=REVIEW_REQUIRED"

curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  "$API_BASE/api/v1/offline/reconciliation/events/$EVENT_ID/decision" \
  -d '{"decision":"APPROVE","reason":"Reviewed source evidence and outlet context"}'
```

## Safety and operations

- `APPROVED_NO_POST` is a review decision only. It is not a sale, payment, stock adjustment or journal.
- Do not manually post approved events to ledgers without a separately approved, tested posting workflow.
- If a submitter attempts self-review, expect HTTP 403 `MAKER_CHECKER_REQUIRED`.
- If an event is not `REVIEW_REQUIRED`, expect HTTP 409 `EVENT_NOT_REVIEWABLE`.
- Keep offline financial posting disabled until legal, accounting, security and runtime gates pass.

## Rollback

Do not drop P526 columns or constraints while review/audit data exists. Rollback requires a controlled database backup, retention decision and an approved migration; preserve all decision audit records.
