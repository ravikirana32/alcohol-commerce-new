# P534 Final Candidate — Test Report

**Release:** 0.534.0-dev  
**Status:** Static verification passed; runtime acceptance remains blocked.

## Executed and passed

| Check | Result |
|---|---:|
| P534 static acceptance | 36/36 PASS |
| Retail checkout integration verifier | 17/17 PASS |
| Bar ticket/refund verifier | 9/9 PASS |
| P533 excise regression (recorded inherited verifier) | 24/24 PASS |
| TypeScript syntax transpilation | 253 files; 0 syntax diagnostics |
| Migration static validation | 236 ordered SQL files PASS |
| ZIP integrity / SHA-256 | PASS |

P534 verifier includes schema/API/UI/version assertions, retail/bar checkout tax integration assertions, jurisdiction/measure/date guards and executable tax-engine fixtures for inclusive/exclusive tax, MRP/menu ceilings, GST conflicts/pair completeness and pure-alcohol volume calculation.

## Not run / blocked

- PostgreSQL clean install, P533 upgrade, migration rollback/reapply and trigger/advisory-lock concurrency tests.
- Vitest: package executable/dependencies not installed.
- Semantic API/web typecheck: dependency and declaration packages unavailable. Syntax transpilation is not semantic typechecking.
- API integration and Playwright/browser E2E.
- Tenant IDOR, exhaustive permission matrix, concurrent price/checkout and failure-injection tests.
- Performance/load testing.
- Official Gazette/rate verification and qualified legal/accounting approval.
- Multi-line invoice rounding and tax-to-settlement/journal reconciliation acceptance by finance.

## Environment notes

Dependency installation did not complete within the environment timeout. PostgreSQL server/client and Docker are unavailable. These checks must be run in a dependency-complete CI/staging environment before production approval.
