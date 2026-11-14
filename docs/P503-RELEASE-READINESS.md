# P503 release readiness

## Verified in this delivery

- P503 quarantine checks: 10/10.
- P502 refund integrity checks: 11/11.
- P501 inherited deterministic checks: 10/10.
- TypeScript/TSX syntax transpilation: 217 files, zero diagnostics.
- Migration static ordering: 214 ordered SQL migration files, with latest migration number 215; static verifier confirms current ordered set.

## Not yet verified

- npm dependency-backed API/web typecheck and production builds.
- Vitest execution.
- PostgreSQL clean installation and upgrade from a populated P502 database.
- API integration tests, transaction rollback, concurrent disposition requests and permission-negative tests against a live database.
- Browser E2E, mobile/offline, printer, cash drawer and POS hardware tests.
- Independent penetration test and security sign-off.
- Karnataka excise/legal review, outlet-specific licence verification and authorised outlet pilot.

## Release decision

**Do not deploy for live alcohol sales.** P503 is a developer-preview increment. The app is not 95% production-certified merely because deterministic source checks pass. A 95% functional target requires passing the outstanding dependency-backed, database, browser, security and operational tests. Legal approval and authorised pilot are external release gates and cannot be waived by code.
