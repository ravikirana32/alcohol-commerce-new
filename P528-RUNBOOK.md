# P528 Runbook

## Apply

1. Back up PostgreSQL and verify restore readiness.
2. Install dependencies from the lockfile.
3. Run `npm run db:migrate` in the deployment environment; migration `227_p528_authoritative_offline_checks.sql` adds the immutable authoritative-check evidence table and permissions.
4. Deploy API and web together at `0.528.0-dev`.
5. Confirm API readiness and inspect migration status.

## Operator flow

1. Receive and review offline events through the P525/P526 workflow.
2. Validate an independently approved event to create a posting intent (P527).
3. Open **Offline reconciliation & validation** and inspect the posting intent.
4. Enter a reasoned note and run authoritative checks.
5. A failed check moves the intent to `HELD`; investigate source evidence and do not edit immutable validation records.
6. A passing check remains `READY_FOR_POST`. It is still not posted and must not be represented as a completed sale/payment/stock movement.

## Guardrails

- Never manually change posting intent status in SQL to bypass a failed check.
- Do not enable offline financial posting or use this phase for production alcohol sales.
- Bar checkouts currently fail closed pending measure-aware stock depletion.
- Verify licence capability mapping against current jurisdictional legal rules before relying on the licence check.
- Preserve audit evidence and follow approved retention policy.

## Rollback

Do not drop evidence tables or delete check rows during application rollback. Roll back API/web code only after assessing compatibility; the additive migration is intended to remain in place. Restore from backup only under the database incident procedure.
