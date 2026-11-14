# Runbook — P151 to P175

## Safe developer setup
1. Use a local disposable PostgreSQL database.
2. Copy `.env.example` to `.env` and supply development-only secrets.
3. Install dependencies using the repository's documented package manager.
4. Review migration ordering and foreign-key dependencies before applying migrations.
5. Run typecheck, tests and build; capture logs and fix failures before proceeding.
6. Use synthetic outlet, product, stock, customer and payment data only.

## Release controls
- Keep AI, offline sync, consumer discovery, payment execution and live notifications disabled until separately reviewed.
- Never use this preview to process real alcohol sales.
- Verify outlet licence permissions and local excise rules with qualified professionals.
- Back up and test restore before any staging upgrade.
- Record deployment, rollback, incident owner and evidence for every release.

## Phase acceptance
Each `docs/phases/P151-*.md` through the current phase defines deliverables and evidence. A checklist is not considered complete until the corresponding test or review has actually run and its evidence is attached.
