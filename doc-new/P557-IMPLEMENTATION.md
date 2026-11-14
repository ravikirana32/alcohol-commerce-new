# P557 — Tenant-Aware API Route Coverage & Resource Ownership Audit

## Scope
P557 adds a reproducible static inventory of route declarations under `apps/api/src/routes/*.ts`. It records HTTP method, declared path, route file, visible permission/authentication middleware markers, visible scope-guard markers, and path identifiers. Outputs are `../reports/P557-TENANT-ROUTE-COVERAGE.json` and `.md`.

## Security interpretation
This is a triage inventory, not proof of tenant isolation. Scope enforcement can live in inherited router middleware, handler code, service/repository logic, or SQL predicates and may not be visible in the route declaration. A visible guard also does not prove correct resource ownership. All unresolved paths require source review and authenticated negative tests with disposable fixtures.

## Safety
No business route, permission grant, migration, or production authorization behavior was changed. Existing P556 GET/HEAD-only runtime harness is retained for negative boundary tests.
