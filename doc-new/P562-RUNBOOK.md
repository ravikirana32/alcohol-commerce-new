# P562 Runbook

## Static verification
```bash
npm run verify:p562:static
npm run verify:p562
npm run check:syntax
npm run verify:migrations
```

## Runtime acceptance required before release
1. Configure a disposable PostgreSQL database and apply all migrations.
2. Seed at least two organisations and two outlets per organisation with sales, bar tickets, payments, refunds and shift cash movements.
3. Authenticate as users in each organisation and call shift preview and close-preview paths for owned and foreign shift IDs.
4. Verify foreign shifts return not-found/denied and no cross-organisation tender, refund or cash movement values appear.
5. Verify same-organisation, different-outlet data is excluded from the selected shift reconciliation.
6. Run API tests, Playwright, migration upgrade tests and independent security review.

Do not enable production payment capture, offline alcohol posting or provider dispatch based on static checks alone.
