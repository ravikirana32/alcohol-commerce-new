# P556 — Multi-Tenant, Outlet & Resource-Level IDOR Security Testing

Version: `0.556.0-dev`

## Delivered
- Added `apps/api/src/services/tenantBoundary.test.ts` for same-tenant acceptance and missing/mismatched tenant rejection.
- Added `apps/api/src/services/permissionScope.p556.test.ts` for outlet-specific and organisation-wide grant behavior.
- Added `scripts/run-p556-tenant-isolation.mjs`, a real-login JWT-based, read-only GET/HEAD negative API harness for cross-organisation, cross-outlet and foreign-resource cases.
- Added `scripts/verify-p556-static.mjs` and package scripts.
- Updated cumulative P513-P556 gap register.

## Security boundaries
The runtime harness requires caller-supplied disposable fixture IDs and explicit API paths. It does not guess resource IDs, create data, or perform mutations. A 403 or 404 is accepted for negative cases to avoid revealing whether a foreign resource exists.

## Not claimed
No route-level IDOR vulnerability is declared fixed. No route handlers or database policies were modified. Helper unit tests and a configurable harness do not establish complete tenant isolation.
