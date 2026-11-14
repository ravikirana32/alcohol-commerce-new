# P529 Runbook — Offline Posting Approval

## Prerequisites

- Start from the P529 cumulative ZIP and configure `.env` from `.env.example`.
- Use a disposable PostgreSQL database for migration and integration testing.
- Install workspace dependencies before attempting typecheck/build.
- Do not enable consumer discovery or live payment capture for this phase.

## Apply migration

```bash
npm install
npm run db:migrate
npm run db:status
```

Migration `228_p529_offline_posting_approval.sql` creates approval evidence and the `AUTHORIZED_TO_POST` state. It does not create a posting worker.

## Run static checks

```bash
npm run verify:p529
npm run check:syntax
npm run verify:migrations
```

Run the cumulative phase verifiers as part of release preparation.

## API workflow

1. Enrol a device and submit a sync batch.
2. Complete reconciliation review.
3. Validate the event and create a posting intent.
4. Complete P528 authoritative checks.
5. A different authorised user submits the approval decision.
6. Inspect `GET /api/v1/offline/posting-approvals`.

Approval response includes `ledgerPosting: NOT_EXECUTED`. Do not treat `AUTHORIZED_TO_POST` as a completed transaction.

## Operational cautions

- The approver must differ from all maker/checker actors recorded for the intent.
- Approval records are immutable; create a new source event for a corrected transaction.
- Rejection holds the intent.
- Do not manually change intent status or insert approval rows.
- Production enablement requires runtime, security, legal, finance and reconciliation sign-off.
