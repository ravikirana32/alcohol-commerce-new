# P553 — Live PostgreSQL Role Matrix, API Authorization & Tenant Isolation

Version: `0.553.0-dev`

## Delivered
- Added `scripts/verify-p553-live-role-matrix.mjs`, a read-only PostgreSQL comparison of the generated migration-derived role/permission matrix against `role_permissions` in the configured database. It uses `BEGIN READ ONLY`, bounded connection/query timeouts, does not print the connection string, and reports both missing and unexpected grants.
- Added `docs/security/P553-TENANT-ISOLATION-TEST-PLAN.md` covering two-organisation/outlet fixture design, positive and negative authorization cases, IDOR substitution, nested-resource ownership, exports/aggregates, async processing, cache keys and evidence retention.
- Added static verifier `scripts/verify-p553-static.mjs` and npm scripts `verify:p553:static`, `verify:p553:live`, and `verify:p553`.
- Retained P552's 13-role/100-permission generated catalogue and 227-route API inventory; no role grants, route permissions or production behavior were broadened.
- Updated application version to `0.553.0-dev`.

## Security design
The live matrix audit is read-only and compares exact `(role_code, permission_code)` pairs. It intentionally does not auto-repair the database. A mismatch must be reviewed against applied migrations, not silently granted. Tenant and outlet isolation remains a resource-ownership concern in addition to route-level permission checks.

## Limitations
The live database audit was not executed because this environment did not provide `DATABASE_URL` or an available PostgreSQL runtime. The tenant isolation plan is a test specification, not executed evidence. Authenticated API allow/deny tests, cross-tenant IDOR tests, runtime browser tests and penetration tests remain open. P553 does not approve production deployment.
