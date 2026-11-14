# P209 — Bar checkout concurrency integrity

## Scope
Harden bar checkout stock reservation and preserve locked open-bottle ml deduction.

## Delivered
- Tracks stock reserved by earlier packaged/bottle lines within the same ticket.
- Locks stock balance rows before checking availability and decrementing.
- Retains `FOR UPDATE` locking for open bottles during peg pours.
- Added source-level regression tests for retail/bar reservation safeguards.

## Validation evidence
- Static syntax transpilation: zero diagnostics across 29 TS/TSX files.
- Source-level assertions added but not executed because dependencies could not be installed.

## Limitations
No PostgreSQL concurrency test or multi-terminal race test was run. Idempotency-key payload hash equivalence is not yet enforced for retail/bar checkout.

**Release classification:** developer preview only. Do not use for live alcohol transactions until the release gates in `docs/SECURITY-AND-RELEASE-GATES.md` are completed.
