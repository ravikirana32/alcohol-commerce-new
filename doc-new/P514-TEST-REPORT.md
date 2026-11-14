# P514 Test Report

| Check | Result | Evidence / limitation |
|---|---|---|
| P513 version synchronisation | PASS | `node scripts/sync-version.mjs` |
| P513 static regression | PASS | `node scripts/verify-p513.mjs` |
| P514 static acceptance | PASS | `node scripts/verify-p514.mjs` |
| TypeScript/TSX syntax scan | PASS | 221 files, zero transpilation diagnostics |
| SQL migration static validation | PASS | 216 ordered migrations, including P514 migration 217; static only |
| P501 deterministic integration | PASS | 10/10; release gate remains not production ready |
| P502 refund integrity | PASS | 11/11 |
| P503 quarantine controls | PASS | 10/10 |
| P504 Docker configuration | PASS | Static configuration only; Docker engine not run |
| P505 release preflight | PASS | Static preflight only; no PostgreSQL runtime |
| P506–P512 static checks | PASS | Static checks only; live API, browser, security and backup/restore tests remain outstanding |
| Dependency installation | BLOCKED | `npm install --offline` failed with ENOTCACHED for `@playwright/test`; no lockfile generated |
| API/web typecheck and production build | BLOCKED | Dependencies unavailable |
| PostgreSQL migration execution | NOT RUN | No verified PostgreSQL service |
| Invitation acceptance/API integration | NOT RUN | Requires running API and disposable PostgreSQL |
| Playwright/browser E2E | NOT RUN | Dependencies and running services unavailable |

## Acceptance decision

P514 is **PARTIAL**. Static source checks pass, but runtime business workflows are not verified. No claim of production readiness is made.
