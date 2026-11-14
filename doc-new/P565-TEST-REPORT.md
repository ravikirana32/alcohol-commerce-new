# P565 Test Report

| Check | Result |
|---|---:|
| P565 static ledger assertions | 11/11 PASS |
| P564 tenant-scoped mutation assertions | 14/14 PASS |
| TypeScript syntax transpilation | 272 files, 0 diagnostics |
| Ordered SQL migration static validation | 242 files PASS |

Not run: P565 SQL against PostgreSQL, database fixtures, Vitest, full stock movement path coverage, concurrency/retry/idempotency tests, live authenticated cross-tenant/outlet tests, Playwright, load/failover, restore drill and penetration testing.

The SQL diagnostic is read-only. Its output requires interpretation: opening balances, adjustments, split/partial receipts and legacy workflows can create legitimate non-one-to-one relationships. Static checks are not runtime proof. Production remains NO-GO.
