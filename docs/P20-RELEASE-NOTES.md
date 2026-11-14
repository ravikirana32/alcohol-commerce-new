# P20 — Production operations and launch readiness

Cumulative developer-preview snapshot through P20, carrying forward P00–P10 and migrations 001 through 020.

- Phase objective: Production operations and launch readiness
- Phase migration: `apps/api/src/db/020_production_ops.sql`
- API handlers: `apps/api/src/routes/ecosystem.ts`
- Detailed implementation notes: `docs/P11-P20-IMPLEMENTATION.md`
- Runbook: `docs/RUNBOOK-P11-P20.md`

The shared router contains later-phase handlers, but later-phase database tables are not present in this ZIP. Use only endpoints whose migrations are included.

Archive integrity has been checked. TypeScript compilation, database migration execution, integration tests, frontend completion, security assessment and legal validation remain pending. This is a developer preview, not a production release.
