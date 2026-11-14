# P513 Test Report

## P513 checks

| Check | Result | Evidence / limitation |
|---|---|---|
| Version synchronisation | PASS | `node scripts/sync-version.mjs` |
| P513 static integration checks | PASS | `npm run verify:p513` |
| TypeScript syntax scan | PASS | 219 TS/TSX files, zero transpilation diagnostics |
| SQL migration static validation | PASS | 215 ordered SQL files; static-only |
| API typecheck | BLOCKED | Dependencies are not installed; package-lock generation timed out |
| Web typecheck | BLOCKED | Dependencies are not installed; package-lock generation timed out |
| Production build | BLOCKED | Dependencies are not installed |
| Vitest | BLOCKED | Dependencies are not installed |
| Playwright E2E | BLOCKED | Dependencies and a verified running API/database are unavailable |
| Docker integration | NOT RUN | Docker daemon/runtime not verified in this execution |
| PostgreSQL migration and transaction tests | NOT RUN | No disposable PostgreSQL service verified |

## Inherited regression checks

| Check | Result | Notes |
|---|---|---|
| P501 deterministic integration gate | PASS | 10/10 deterministic checks; gate itself states `productionReady=false` |
| P502 refund integrity | PASS | 11/11 checks |
| P503 quarantine disposition | PASS | 10/10 checks |
| P504 Docker configuration | PASS | Static configuration only; Docker engine not exercised |
| P505 release/preflight | PASS | Static preflight/configuration checks; PostgreSQL runtime not exercised |
| P506 static probes | PASS | Static test definitions and disabled live features |
| P506 live API smoke | FAIL / ENVIRONMENT | Default `http://localhost:8080` returned HTTP 404 for liveness, readiness and tenant boundary. No live P506 runtime pass is claimed. |
| P507 static checks | PASS | Playwright configuration/spec presence; browser suite not executed |
| P508 security static checks | PASS | Security baseline presence; no penetration test |
| P509 offline static checks | PASS | Offline disabled by default; no device/reconnect test |
| P510 procurement static checks | PASS | GRN/invoice-match schema checks only; no procurement E2E |
| P511 operations static checks | PASS | Backup/restore script and runbook presence; no restore drill |
| P512 release-gate static checks | PASS | Gate remains closed / NOT_APPROVED |

## Baseline command wiring repaired

- `verify:p510` previously pointed to a missing script; it now invokes the existing P510 static verifier.
- `verify:p511:static` previously pointed to a missing script; it now invokes the existing P511 operations static verifier.

## Interpretation

A static pass does not prove a business workflow works end to end. A failed or unrun runtime check is not a pass. P513 remains **PARTIAL** until a clean dependency installation, API/web typechecks, production builds and live API/database integration checks are completed.
