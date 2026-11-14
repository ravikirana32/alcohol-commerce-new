# P492 — Secret rotation overlap policy

## Delivered
- Added `apps/api/src/services/secretRotation.ts` with exported policy/function `isSecretAcceptedDuringRotation`.
- Added deterministic positive and negative smoke assertions in `scripts/verify-p451-p500-invariants.cjs`.

## Integration status
This is a reusable domain/policy component. It is not automatically applied to every API route or UI workflow. Route wiring, persistence and live integration must be validated separately before production use.

## Validation
The phase assertion is executed by the cumulative P451–P500 verifier. Full workspace typecheck, PostgreSQL migration execution, API/browser E2E and legal/provider certification remain separate release gates.
