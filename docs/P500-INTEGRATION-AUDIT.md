# P500 Full-Codebase Integration Audit and Remediation

**Audit baseline:** P500 cumulative source, `0.500.0-dev`  
**Remediation source version:** `0.500.1-dev`  
**Scope:** integration, consistency, runtime lifecycle and verification. No new business feature scope.

## Executive result

P500 is not a fully integrated product. The source contains 159 API service modules, 9 API routers and a small React workspace. A heuristic static reference scan flagged 153 of 159 service modules as unreferenced or only weakly referenced by API source (this requires manual triage; it is not proof that every flagged module is dead code). The README itself states that P451–P500 policy modules are not all wired into authenticated routes, transactional persistence or complete UI journeys.

The web package version was `0.350.0-dev` while the root/API were `0.500.0-dev`; the UI footer and API root response also exposed older version values. These inconsistencies have been corrected to `0.500.1-dev`.

## Confirmed findings

| Finding | Severity | Evidence / action |
|---|---|---|
| Version drift | Medium | Root/API/web, VERSION, API root and UI footer now use `0.500.1-dev` |
| Many service modules disconnected | High | Static reference audit lists modules not imported by API route/service workflows; requires per-domain integration |
| Startup configuration validation absent | High | Added required env and JWT secret-strength validation at API startup |
| Request correlation not integrated | Medium | Added middleware, bounded incoming ID validation and `X-Request-Id` response header |
| Correlation ID fallback used Math.random | Medium | Replaced with Node `randomUUID()` |
| Graceful shutdown not integrated | High | Added drain mode, HTTP server close and PostgreSQL pool cleanup |
| Readiness did not include drain state | Medium | `/api/health/ready` now reports not-ready during shutdown |
| Duplicate migration numeric prefixes | Review | Prefixes 150, 151 and 176 each have two distinct filenames; migration runner orders full filenames lexicographically. Do not rename already deployed migrations. Verify actual applied history against a database before release |
| Full package install/build not available | Blocker | `npm install` stalled in this environment; no dependencies/node_modules available |
| API typecheck fails without dependencies | Blocker | Global `tsc` reports missing Express/Zod/Node type declarations and downstream implicit-any diagnostics; cannot call this a valid project typecheck |
| Browser UI remains limited | High | Navigation shell and one-line retail/bar checkout workspace; not full admin, inventory, partner, finance or reporting journeys |
| Token handling | High | Web app currently stores bearer access token in sessionStorage; evaluate migration to secure HttpOnly cookie/BFF session design before production |

## Changes made in this remediation

1. Aligned root, API and web package versions to `0.500.1-dev`.
2. Updated `VERSION`, API root metadata and UI footer.
3. Added API startup validation for `DATABASE_URL`, `JWT_SECRET` and `WEB_ORIGIN`; rejects weak JWT secrets.
4. Added safe request correlation middleware; malformed supplied IDs receive HTTP 400; response includes `X-Request-Id`.
5. Replaced non-cryptographic correlation ID generation with `crypto.randomUUID()`.
6. Added shutdown drain state, HTTP server close and PostgreSQL pool close on SIGTERM/SIGINT.
7. Included draining state in readiness.
8. Added focused Vitest cases for correlation and shutdown policy.
9. Added `npm run audit:integration` and `npm run verify:release-gate` scripts.

## Static audit snapshot

- API routers: 9 imported and mounted; route source files exist.
- API service modules: 159; 153 flagged by the heuristic as unreferenced/low-reference (manual triage required).
- Database migration files: 209.
- Duplicate numeric prefixes: 150, 151, 176 (distinct migration filenames).
- Release state: NOT PRODUCTION READY.

The integration audit script intentionally reports unreferenced service modules. That list is a backlog, not proof each module is defective; some may be helpers or planned policies. Each must be traced to a real workflow, integrated with tests, or marked unused/deprecated.

## Required next integration sequence — no new features

1. **Dependency and build baseline:** install pinned dependencies, lock versions, resolve type errors, build API and web.
2. **API contract map:** document each router, middleware, role, licence gate, request schema, transaction boundary and database table.
3. **Retail vertical slice:** login → outlet permission → price lookup → cart → server-priced checkout → stock ledger → payment → receipt → refund/return → shift reconciliation.
4. **Bar vertical slice:** login → licensed bar outlet → table/ticket → peg conversion → open-bottle lock/deduction → payment → wastage/breakage → refund → shift close.
5. **Inventory vertical slice:** supplier → purchase order → approval → goods receipt → stock ledger → transfer → count/variance → valuation.
6. **Finance vertical slice:** settlement → journal → reconciliation → period close → export, with balanced double-entry checks.
7. **Portal/tenant vertical slice:** tenant boundary and role tests for platform, retailer, bar, brand, distributor and trade partner.
8. **Offline vertical slice:** durable local outbox, idempotent server ingestion, replay protection, conflict handling and recovery testing.
9. **Security:** secure session architecture, CSRF if cookie sessions, rate limiting, tenant isolation, secret rotation, audit integrity, dependency scanning and independent penetration test.
10. **Release evidence:** PostgreSQL migration rehearsal, API/browser E2E, backup restore, load tests, provider certification, Karnataka legal/excise approval and authorised outlet pilot.

## Validation performed in this environment

- Node and npm versions detected.
- `integration-audit.mjs`: passed route-file/mount and version consistency checks; reports disconnected service modules and duplicate migration prefixes.
- `verify-release-gate.mjs`: 2/2 policy assertions passed.
- Runtime policy smoke checks: 6/6 passed (correlation ID generation/validation and drain-state policy).
- Existing cumulative invariant scripts: P401–P450 50/50 and P451–P500 50/50 passed.
- Migration static verifier: 209 SQL files passed ordering check; preflight warns on duplicate prefixes 150, 151 and 176.
- Vitest test files present: 8; the new runtime Vitest suite was added but not executed because dependencies are unavailable.
- Global TypeScript `tsc` attempted against API: failed because project dependencies/type declarations are absent. This is a blocker, not a pass.
- `npm install` did not complete within the execution window.
- No PostgreSQL service was available for migration execution.
- No API server, browser E2E, payment/hardware provider, penetration test, legal review or outlet pilot was run.

## Release decision

**HOLD — engineering preview only.** This remediation improves integration hygiene but does not complete the business platform or certify production readiness.


## P500.2 follow-on — retail checkout integration

The next remediation iteration added a canonical SHA-256 request fingerprint to retail sales, idempotency payload mismatch protection, legacy replay reconstruction, integer minor-unit arithmetic, tenant-scoped guarded stock deduction, a checkout audit event, a scoped sale-detail endpoint and exact-request UI retry handling. Migration 211 is additive and must be applied before deploying version `0.500.2-dev`.

Static verification currently reports 210 SQL migration files. Historical duplicate numeric prefixes 150, 151 and 176 remain. The integration-audit service reference count is a heuristic and must not be interpreted as proof that every flagged module is unused. Full dependency installation, typecheck/build, PostgreSQL execution, API/browser E2E, security review, Karnataka excise/legal approval and outlet pilot remain open.
