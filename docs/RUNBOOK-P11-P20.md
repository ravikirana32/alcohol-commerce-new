# P11–P20 developer runbook

## Local startup
1. Copy `.env.example` to `.env`; configure `DATABASE_URL`, `JWT_SECRET` (at least 32 characters), and `BOOTSTRAP_SECRET`.
2. Start PostgreSQL and Redis using `docker compose up -d`.
3. Install workspace dependencies with `npm install`.
4. Apply migrations in order using `npm run db:migrate`.
5. Start the API and web workspace using `npm run dev`.
6. Check `/api/health/live` and `/api/health/ready`.

## Phase migration boundaries
- P11: through `011_multi_outlet.sql`
- P12: through `012_finance_accounting.sql`
- P13: through `013_crm_consent.sql`
- P14: through `014_brand_portal.sql`
- P15: through `015_distributor_portal.sql`
- P16: through `016_trade_engagement.sql`
- P17: through `017_consumer_discovery.sql`
- P18: through `018_analytics_reporting.sql`
- P19: through `019_offline_sync_integrations.sql`
- P20: through `020_production_ops.sql`

A phase ZIP intentionally includes migrations only through its phase. The shared router source contains later route handlers, but those handlers require later migrations.

## Safety notes
- Keep `AI_FEATURES_ENABLED=false` unless AI functionality is separately scoped and approved.
- Keep `OFFLINE_SYNC_ENABLED=false` until device identity, cryptographic integrity and conflict resolution are production-tested.
- Do not expose consumer listings until legal review is documented.
- Do not activate brand campaigns or incentives without applicable legal review.
- Do not store provider secrets in plaintext in `integration_connections`; use a secret manager and store only secret references.
- Do not run unreviewed migrations on production.
