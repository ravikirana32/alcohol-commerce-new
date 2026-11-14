# Runbook — P176 to P200

## Safe validation sequence
1. Use a disposable local PostgreSQL database and synthetic business data.
2. Review `.env.example`; use development-only secrets.
3. Inspect migration ordering and foreign-key dependencies before applying migrations.
4. Install dependencies, run typecheck, unit tests, integration tests and production builds.
5. Verify clean install and upgrade paths; retain logs and test reports.
6. Exercise retail, bar, inventory, finance and partner workflows in a non-production environment.

## Release gates
- Keep AI, offline sync, consumer discovery, live payments and live notifications disabled until individually implemented, reviewed and tested.
- Verify each outlet's licence permissions and local excise requirements with qualified professionals.
- Test tenant isolation, audit history, backup restore and rollback before any pilot.
- Never use this developer preview to process real alcohol transactions.

## Evidence
A phase is complete only when its deliverables have executable evidence, test reports and accountable sign-off. A checklist or SQL phase registration alone is not completion.
