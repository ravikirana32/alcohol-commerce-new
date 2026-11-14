# P335 — Hardware and payment integration adapters

## Scope
Add adapter interfaces for scanner/printer/payment terminals; no provider credentials or live settlement.

## Phase artifact
`apps/api/src/integrations/hardware.ts`

## Delivery classification
source-implemented

## Verification
- ZIP archive integrity: verified after creation.
- Phase artifact presence: verified.
- Dependency installation: not completed (npm install timed out).
- Typecheck/build/unit tests: not executed.
- PostgreSQL migration execution: not executed.
- Browser/device/hardware tests: not executed.
- Legal/excise certification: not performed.

## Acceptance boundary
This phase is an incremental engineering preview, not a production release. A pure utility or documentation artifact does not mean the corresponding full business workflow is complete.
