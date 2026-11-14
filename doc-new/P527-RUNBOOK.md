# P527 Runbook — Offline Validation and Posting Intents

1. Install dependencies using the repository's pinned package manager/lockfile.
2. Configure API environment using `.env.example`; set `OFFLINE_SYNC_ENABLED=true` only in a controlled test environment.
3. Start PostgreSQL and apply migrations through the existing migration runner (`npm run db:migrate`). Migration 226 depends on P525/P526 migrations.
4. Start API and web workspaces using `npm run dev`.
5. Enrol a test device and submit a batch using the P525 APIs.
6. Have a different authorised user review/approve a `REVIEW_REQUIRED` event in the Offline Reconciliation workspace.
7. For an approved event, provide validation notes and invoke Validate. Inspect the individual checks and result.
8. Confirm passing financial/stock events appear in Posting Intents with `READY_FOR_POST`; diagnostics must not appear there.
9. Confirm no sale, payment, stock movement or journal rows are created by P527. Never manually treat `READY_FOR_POST` as posted.
10. Run `node scripts/verify-p527.mjs`, `node scripts/check-typescript-syntax.mjs`, and `python3 scripts/verify-migrations.py`.

## Operational caution
Do not enable production offline checkout. P527 performs structural checks only and creates a durable intent; it does not validate live product/price/tax/licence/stock/payment state or post a ledger. Test in a disposable database before any pilot.
