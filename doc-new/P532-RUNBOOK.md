# P532 Runbook — Offline Exception Recovery

## Prerequisites

- PostgreSQL service available and configured through `DATABASE_URL`.
- Install workspace dependencies with `npm install`.
- Apply migrations with `npm run db:migrate` from repository root.
- Deploy API and web application from the same `0.532.0-dev` release.

## Operator workflow

1. Open **Offline reconciliation & validation**.
2. Review the **Offline exception recovery** panel. Terminal blocked postings should appear automatically after migration 231 is applied.
3. Enter evidence notes and select **Triage case**.
4. For a blocked intent, select **Request corrected-event retry** only after the source data can be corrected. Submit a new source event through the enrolled device workflow; do not replay the original immutable execution.
5. Select **Cancel held intent** only when the transaction must be abandoned. Cancellation retains all original evidence.
6. For a posted transaction that requires review, create a case from the execution API, triage it, then request compensation review.
7. A separate user with `offline:recovery-compensate` must approve or reject the compensation request.
8. An approved compensation case is only a P536 handoff. Do not tell customers that a refund, stock reversal or accounting reversal occurred.

## API examples

```bash
curl -H "Authorization: Bearer $TOKEN" "$API/api/v1/offline/recovery/cases"
curl -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"notes":"Reviewed source event and verified outlet evidence"}' \
  "$API/api/v1/offline/recovery/cases/$CASE_ID/triage"
```

## Rollback / operational safety

- Do not delete recovery cases or action history manually.
- Do not edit or delete `offline_posting_executions` to force a retry.
- If migration 231 fails, stop deployment and preserve the database; diagnose before retrying migration.
- Financial compensation remains disabled until P535/P536 and legal approvals are complete.
