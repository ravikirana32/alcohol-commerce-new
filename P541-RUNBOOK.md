# P541 Runbook

1. Start from the P540 deployment and take a verified database backup.
2. Set `VERSION=0.541.0-dev` (already reflected in repository files) and review environment configuration.
3. Run `npm ci` from repository root.
4. Run `npm run db:migrate --workspace @acp/api` to apply migration 242.
5. Run `node scripts/verify-p541-security.mjs`, `node scripts/verify-p540-integrations.mjs`, `python3 scripts/verify-migrations.py`, and `node scripts/check-typescript-syntax.mjs`.
6. For production-like multi-instance environments, configure a shared gateway/Redis authentication rate limiter before exposing traffic. Do not rely on the process-local limiter as the only control.
7. Validate audit access with organisation-scoped accounts; verify UPDATE/DELETE against `security_audit_events` is rejected by the database trigger.
8. Execute a real backup restore drill in an isolated environment and record the external evidence reference/checksum. Do not create a fabricated recovery-evidence record.
9. Complete penetration, load, browser, API and PostgreSQL tests before considering a release gate.

The environment used to prepare this phase did not have a running PostgreSQL or Docker service, so database execution and restore drills are not claimed as complete.
