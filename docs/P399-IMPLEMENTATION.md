# P399 — Pilot closure and training gate

## Delivered in this phase
- Added `apps/api/src/services/pilotClosure.ts` with deterministic validation/business-rule functions.
- Inputs are validated before downstream persistence or external side effects.
- Functions are intentionally dependency-light and suitable for unit/integration wiring.

## Integration status
This phase delivers a source-level domain component. It is not evidence that every API route, database transaction, POS screen, third-party provider or native device integration is wired end-to-end.

## Verification
- Static TypeScript transpilation is checked in the P351–P400 delivery report.
- Database, browser, provider, hardware, legal and production verification remain separate release gates where applicable.
