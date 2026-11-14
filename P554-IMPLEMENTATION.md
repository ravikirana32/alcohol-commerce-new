# P554 — Automated Authenticated API Authorization Matrix

## Scope
Add a repeatable API middleware authorization matrix over every role and distinct permission in the migration-derived P552 permission catalogue.

## Implemented
- Added `apps/api/src/security/p554AuthorizationMatrix.test.ts`.
- The test harness loads the generated permission matrix, enumerates all roles and unique permission codes, mounts protected Express endpoints using the real `requirePermission` middleware, and asserts 200 for exact grants and 403 for non-grants.
- Added unauthenticated 401 coverage and explicit `PERMISSION_DENIED` response assertions.
- Added `scripts/verify-p554-static.mjs`, npm commands, version `0.554.0-dev`, and this phase's operational documentation.

## Security boundary
The harness injects a test identity and permission list. It tests real Express middleware behavior against the generated permission catalogue, but it does not validate JWT signature/session authentication, database-derived grants, actual route handlers, organization/outlet resource scoping, or deployed API behavior. Those remain separate acceptance gates.
