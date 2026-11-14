# P549 — Complete Role Permission Matrix & Action-Level Authorization

Version: `0.549.0-dev`  
Baseline: P548 cumulative ZIP  
Status: Developer preview; static verification only.

## Implemented

- Scanned SQL migration source for literal `(role_code, permission_code)` inserts into `role_permissions` and generated `apps/api/src/authz/permission-matrix.generated.json`.
- Generated a frontend workspace policy snapshot at `apps/web/src/permissionPolicy.generated.json` from the existing P548 navigation map.
- Added `apps/web/src/actionPermissions.ts`, a reusable exact-permission policy for checkout, refunds, shift, inventory, procurement, finance, reports, compliance, tax, devices, offline review, organisation, user administration, audit and integrations.
- Added `canPerformAction`; it uses exact permission membership and does not infer access from role names.
- Added `scripts/verify-p549-permissions.mjs` and npm commands `verify:p549` and `test:permissions:p549`.
- Did not modify or broaden backend grants. Backend `authenticate` and `requirePermission` remain authoritative.
- Version synchronized to `0.549.0-dev`.

## Generated matrix snapshot

The literal migration scan found 13 role codes and 99 distinct permission codes. This is a static snapshot of SQL literal inserts, not a live database export. Dynamic SQL, runtime changes and manual database grants must be compared against PostgreSQL before relying on it.

## Not completed

- No exhaustive action inventory of all component buttons/forms has been wired to `canPerformAction` yet; the new policy is a reusable baseline for subsequent migration.
- No live database comparison or seeded-role API test was run.
- No frontend build, browser E2E, or focused Vitest execution was run.
- No cross-tenant IDOR or outlet-scope runtime test was run.
