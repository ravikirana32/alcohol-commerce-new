# P304 — Backup, restore and migration recovery runbook

## Scope
Add PostgreSQL backup/restore scripts with safe argument handling and non-destructive defaults.

## Phase artifact
`scripts/db-backup.sh`

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
