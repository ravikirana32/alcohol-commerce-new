# P521 Runbook

## Prerequisites
- Node.js/npm versions compatible with the workspace and a clean dependency install.
- PostgreSQL disposable development database.
- Environment variables configured using the existing `.env.example`; never commit secrets.
- Apply migrations using the established project migration runner.

## Commands
```bash
npm ci
npm run verify:p521
npm run check:syntax
npm run verify:migrations
npm run typecheck
npm run build
npm run db:migrate
npm test
```

## Finance API smoke workflow
1. Authenticate as an organisation owner or finance-enabled manager.
2. Create two accounts in the same organisation (for example cash ASSET and sales INCOME).
3. Post a balanced journal with equal debit and credit.
4. Request the trial balance for a date range containing the journal.
5. Attempt an unbalanced journal and verify it is rejected with `JOURNAL_NOT_BALANCED`.
6. Attempt to post using an account/outlet from another organisation and verify rejection.
7. Verify the database rejects any committed posted journal whose lines do not balance.

## Important
The current phase does not auto-post sales/purchases/refunds to finance. Do not use this as a statutory ledger or for production accounting until automatic source postings, tax mappings, period controls, CA review and runtime tests are complete.
