# P207 — Migration integrity and drift detection

## Scope
Add migration order verification and SHA-256 drift detection in the migration runner.

## Delivered
- Added static migration ordering/dependency verifier.
- Added checksum registry and migration-runner checksum comparison.
- Existing applied migrations without hashes receive a first-run baseline hash; subsequent drift is rejected.

## Validation evidence
- Static migration verifier: 209 P205 SQL files ordered; early phase register precedes P151/P176 seed migrations.
- PostgreSQL migration execution was not available.

## Limitations
Checksum tracking cannot prove historical integrity before the first checksum baseline is captured. Clean install and upgrade execution on PostgreSQL remain mandatory.

**Release classification:** developer preview only. Do not use for live alcohol transactions until the release gates in `docs/SECURITY-AND-RELEASE-GATES.md` are completed.
