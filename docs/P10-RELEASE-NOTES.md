# P10 — Shift closing and reconciliation

Cumulative developer-preview snapshot through P10. Includes P03 baseline and ordered migrations 001 through 009.

- Phase objective: Shift closing and reconciliation.
- Operational API source: `apps/api/src/routes/operations.ts`.
- Migration runner: `npm run db:migrate`.
- Permission seeds are installed by P04 migration 003.
- Platform admins can provision initial organisation members and outlets; share initial credentials only over a secure channel and force password reset before production.
- Later-phase endpoints are present in the shared route source but their tables do not exist until their corresponding migration is included.

This is not a production release. Build, migrations, integration tests, browser tests, security validation and legal compliance review remain pending.
