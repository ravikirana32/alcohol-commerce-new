# P572–P574 Runbook

## Apply migrations and verify on a disposable PostgreSQL database
From repository root:

```bash
export DATABASE_URL='postgres://...'
npm ci
npm run db:migrate
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/verify-p572-p574-postgres.sql
```

Or run:

```bash
DATABASE_URL='postgres://...' bash scripts/run-p572-p574-postgres-validation.sh
```

Do not run acceptance migrations against production without the normal release/change approval process.

## Opening baseline
1. Stop/quiet outlet stock activity operationally.
2. Complete and approve a physical stock count.
3. Capture the baseline once using `POST /inventory/opening-balance-snapshots`.
4. The API takes the outlet ledger advisory lock; do not bypass the API and write snapshot rows manually.
5. Verify the snapshot line count and compare against signed physical count evidence.

## Reconciliation
`POST /inventory/reconciliation-runs` captures a cutoff and baseline reference. Review `GET /inventory/reconciliation-exceptions` and investigate each exception. No stock is changed by reconciliation.

## Variance correction
- Create: `POST /inventory/variance-correction-requests` with `Idempotency-Key`, `exceptionId`, `delta`, `reason`, optional `evidenceReference`.
- Review queue: `GET /inventory/variance-correction-requests?status=PENDING`.
- Approve: `POST /inventory/variance-correction-requests/:requestId/approve` as a different user than the requester.
- Reject: `POST /inventory/variance-correction-requests/:requestId/reject` with a reason, as a different user.
- Approval appends a signed idempotent stock adjustment and updates balance atomically.
- A correction that would make stock negative is rejected.

## Runtime concurrency acceptance
Use two independent database sessions and prove:
1. Hold a stock movement transaction after insert but before balance update.
2. Start baseline capture; it must wait for the movement transaction.
3. Commit movement and balance mutation; baseline then captures the committed balance.
4. Reverse the order: hold baseline capture; movement insert must wait until baseline commits.
5. Repeat with concurrent approvals for the same correction request; only one movement and one balance mutation may exist.
