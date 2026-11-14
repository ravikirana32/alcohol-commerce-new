# P209 Implementation Status

- Phase: P209
- Status: source changes delivered; developer preview
- Scope: Bar checkout concurrency integrity
- Runtime/database verification: not completed in this environment
- Production readiness: not certified

- Tracks stock reserved by earlier packaged/bottle lines within the same ticket.
- Locks stock balance rows before checking availability and decrementing.
- Retains `FOR UPDATE` locking for open bottles during peg pours.
- Added source-level regression tests for retail/bar reservation safeguards.
