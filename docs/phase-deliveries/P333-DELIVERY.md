# P333 — Offline conflict resolution

## Scope
Add explicit conflict classification; financial conflicts require server review, never silent overwrite.

## Phase artifact
`apps/api/src/services/offlineConflict.ts`

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
