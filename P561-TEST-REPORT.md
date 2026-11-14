# P561 Test Report

| Test | Result |
|---|---:|
| Bar KOT organisation predicate assertion | PASS |
| Offline recovery organisation predicate assertion | PASS |
| Finance journal organisation predicate assertion | PASS |
| Retail sale refund organisation predicate assertion | PASS |
| Outlet shift close organisation predicate assertion | PASS |
| P561 verifier | 5/5 PASS |
| P560 static verifier | 10/10 PASS |
| P559 static verifier | 8/8 PASS |
| P558 static verifier | 10/10 PASS |
| P557 static verifier | 10/10 PASS |
| P556 static verifier | 10/10 PASS |
| P555 static verifier | 10/10 PASS |
| P554 static verifier | 10/10 PASS |
| P553 static verifier | 10/10 PASS |
| P552 API permission parity | 8/8 PASS |
| TypeScript syntax | 272 files, 0 diagnostics |
| SQL migration static validation | 242 ordered files PASS |

## Runtime tests not run
PostgreSQL clean install/upgrade, live database permission comparison, authenticated API allow/deny, cross-organisation and cross-outlet IDOR, Vitest, Playwright, performance, backup/restore and penetration testing were not executed. Static assertions verify source shape only, not database behaviour.
