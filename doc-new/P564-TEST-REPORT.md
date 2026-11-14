# P564 Test Report

| Check | Result |
|---|---:|
| P564 targeted source assertions | 14/14 PASS |
| P563 targeted source assertions | 10/10 PASS |
| P562 targeted source assertions | 8/8 PASS |
| P561 targeted source assertions | 5/5 PASS |
| TypeScript syntax transpilation | 272 files, 0 diagnostics |
| Ordered SQL migration static validation | 242 files PASS |

Not run: PostgreSQL clean install/upgrade, API Vitest, live authenticated API allow/deny matrix, cross-tenant/outlet IDOR, concurrent inventory transfer and receipt posting, Playwright, load/failover, restore drill and penetration testing.

Static checks validate expected source patterns only. They are not substitutes for runtime tests. Production remains NO-GO.
