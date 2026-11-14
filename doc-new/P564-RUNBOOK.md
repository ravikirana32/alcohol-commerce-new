# P564 Runbook

## Static verification
```bash
npm run verify:p564
npm run verify:p563
npm run verify:p562:static
npm run verify:p561
npm run check:syntax
npm run verify:migrations
```

## Runtime acceptance (disposable environment only)
1. Configure a disposable PostgreSQL database and apply all migrations from a clean state.
2. Seed separate organisations A and B, each with separate outlets, products, stock balances, purchase orders, approvals, transfer headers and child lines.
3. Authenticate users from each organisation using the seeded role accounts.
4. Attempt to dispatch and receive organisation A transfer using organisation B token and foreign child-line IDs; expect not-found/denied and unchanged stock/ledger rows.
5. Repeat for outlet transfers, PO submit/review, receipt posting and stock balance conflicts.
6. Run concurrent dispatch/receipt requests and verify one valid state transition, no negative stock, no duplicate movement and consistent parent/child state.
7. Capture before/after database evidence and API responses; do not enable live payment capture or offline alcohol posting as part of this test.

Do not run destructive scenarios against production. P564 does not authorize production release.
