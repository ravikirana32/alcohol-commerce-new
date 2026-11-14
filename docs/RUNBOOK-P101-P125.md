# P101–P125 runbook

This cumulative snapshot includes phase registrations through P125. They are disabled capability registrations and do not mean workflows are complete.

1. Back up PostgreSQL and verify restore readiness.
2. Review migrations and apply using the repository migration runner in numeric order.
3. Confirm new capabilities remain disabled.
4. Run dependency install, typecheck, lint, unit, integration, API, UI and E2E tests in CI.
5. Validate tenant isolation, billing/peg transaction integrity, offline sync, device compatibility and security.
6. Obtain jurisdiction-specific legal review and pilot acceptance before activation.

AI stays disabled by default. Consumer alcohol discovery/marketing remains jurisdiction-gated. Licence permissions cannot be inferred from software configuration.
