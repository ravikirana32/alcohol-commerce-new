# P563 Test Report

| Check | Result |
|---|---:|
| P563 inventory/procurement source assertions | 10/10 PASS |
| P562 shift reconciliation source assertions | 8/8 PASS |
| P561 tenant update assertions | 5/5 PASS |
| P560 static verification | 10/10 PASS |
| TypeScript syntax transpilation | 272 files, 0 diagnostics |
| SQL migration static validation | 242 files PASS |

The migration validator is static-only; its startup emitted a spreadsheet-runtime warmup diagnostic after the successful migration result. No PostgreSQL clean install/upgrade was performed.

Not run: Vitest, PostgreSQL runtime tests, authenticated API cross-tenant/outlet tests, Playwright, penetration testing, production build.
