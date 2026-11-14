# P303 — Database migration preflight and ordering validation

## Scope
Add deterministic migration preflight checks for duplicate prefixes, lexical order, missing dependencies and checksum registry shape.

## Phase artifact
`scripts/preflight-migrations.py`

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
