# P406 — Retail price book resolution

## Delivered
- Added `apps/api/src/services/priceBook.ts` exporting `resolveUnitPrice`.
- Validates input invariants and returns deterministic domain results without external side effects.
- Added to the P401–P450 invariant smoke-test suite.

## Integration status
This is a domain component, not proof of end-to-end API, database, UI, device or provider integration. Production activation requires tenant-scoped persistence, authorization, audit logging, operational monitoring and relevant legal controls.

## Verification
The P401–P450 smoke suite exercises this component. Full workspace typecheck/build, PostgreSQL migration execution, browser E2E and deployment checks remain separate gates.
