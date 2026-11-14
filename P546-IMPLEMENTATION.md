# P546 Implementation — Database Integrity & Role-Based Demo User Seeder

- Version: `0.546.0-dev`
- Baseline: P545 cumulative source
- Status: developer preview; static verification passed, PostgreSQL runtime seeding not executed here.

## Delivered

1. Added `apps/api/src/db/seed-demo-users.ts`, a transaction-based local demo seeder.
2. Seeder discovers every distinct role from `role_permissions` after migrations, plus `PLATFORM_ADMIN`; it does not maintain a fragile hard-coded role list.
3. Creates one active demo user per role, with bcrypt cost 12 password hashes. Platform admin is flagged as platform admin; all other accounts receive an active membership in the synthetic `ACP Local Demo` organisation and access to its `DEMO-001` hybrid outlet.
4. Seeder is guarded by `NODE_ENV !== production`, explicit `DEMO_SEED_ENABLED=true`, and a required 14–128 character `DEMO_SEED_PASSWORD`. It does not print secrets.
5. Added `npm run db:seed:demo` at root and API workspace levels, plus `npm run verify:p546`.
6. Added `.env.example` documentation with demo seeding disabled by default.
7. Added `P546-RUNBOOK.md` with startup commands, demo account emails, shared-password setup, role email convention, verification SQL, disable procedure and troubleshooting.
8. Added a database integrity SQL checklist for post-migration and post-seed review.

## Seeded role model

The authoritative role list is the distinct `role_code` set in `role_permissions`. The runbook lists common roles explicitly and documents the deterministic email convention for additional roles. Every seeded user uses the same operator-supplied local-only password. No production or universal default password is embedded in the source.

## Security notes

- The seeder is a development/QA fixture, not production provisioning.
- It intentionally shares one local password across synthetic accounts to simplify role-by-role UI testing.
- Rerunning it resets all demo users to the supplied password and reactivates them.
- Disable demo users after QA. Never enable demo seeding in production.
- Existing production release gates remain unchanged; this phase does not grant production approval.
