# P503 Release Notes

Version: 0.503.0-dev

- Adds an organisation-scoped returned peg quarantine queue.
- Adds manager-only disposition actions for disposal and compliance-recorded disposition.
- Requires a compliance reference for `RELEASED_BY_COMPLIANCE`.
- Records actor, reason, timestamp and audit evidence.
- Does not return quarantined liquid to saleable stock.
- Adds quarantine queue controls to Bar Tickets & Refunds.
- Adds migration 215 and P503 test/verification scripts.

Developer preview only. Live outlet deployment remains blocked on dependency-backed builds/tests, PostgreSQL clean-install and upgrade tests, browser E2E, independent security review, Karnataka excise/legal approval and authorised outlet pilot.
