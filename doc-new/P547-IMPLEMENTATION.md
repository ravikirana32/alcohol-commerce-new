# P547 — Role-Based Access Control & Permission Validation

- Version: `0.547.0-dev`
- Baseline: P546 cumulative source
- Status: developer preview; static verification only, runtime/database acceptance pending.

## Delivered

1. Added focused Vitest coverage for `requirePermission`: unauthenticated 401, exact permission allow, missing permission 403, and no prefix/substring permission matching.
2. Added outlet-scope tests for matching outlet grants, mismatched outlet denial, organisation-wide grants and unknown permission denial.
3. Added `scripts/verify-p547-rbac.mjs` and `npm run verify:p547` to assert authentication reloads active membership, permission grants are loaded from `role_permissions`, permission middleware denies missing grants, the P546 demo seeder remains opt-in and production-blocked, and tests/runbook coverage exists.
4. Added `npm run test:rbac:p547` for focused runtime unit tests when dependencies are installed.
5. Extended P546 runbook with per-role login, `/auth/me`, permission-denial, membership-revocation and role-matrix SQL instructions.

## Authorization behavior reviewed

- Tenant login selects an active organisation membership; an explicitly requested organisation without membership is denied.
- Authenticated requests re-check active membership and reload permission codes from `role_permissions`.
- Route-level `requirePermission` uses exact permission-code membership and returns 403 for missing grants.
- Platform administrator grants are loaded from `PLATFORM_ADMIN` role permissions.

## Not claimed

No PostgreSQL-backed login, API authorization, tenant IDOR, UI navigation or Playwright test was executed in this environment. Static source checks do not prove route coverage or runtime isolation. The existing P546 demo-user runtime gap remains open.
