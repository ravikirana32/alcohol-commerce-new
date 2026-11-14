# P515 Runbook — Catalogue and Pricing

## Prerequisites

- Node.js 20.18+ and npm 10.8+.
- Docker Engine and Docker Compose plugin.
- PostgreSQL service and `DATABASE_URL` configured using `.env.example`.
- Install workspace dependencies from repository root: `npm install`.

## Start local stack

```bash
cp .env.example .env
# Set strong local secrets and DATABASE_URL; do not commit .env.
npm install
npm run version:sync
npm run docker:up
npm run db:migrate
npm run dev
```

If the compose stack already runs API and web, use `npm run docker:ps` and `npm run docker:logs` instead of starting duplicate processes.

## Verify P515

```bash
node scripts/verify-p515.mjs
node scripts/check-typescript-syntax.mjs
python3 scripts/verify-migrations.py
npm run typecheck
npm run build
npm test
npm run test:e2e
```

## Catalogue smoke workflow

1. Sign in as an organisation owner/manager with `catalogue:manage`.
2. Create a category and a brand.
3. Create a product linked to both, including SKU, barcode, pack size, ABV and tax metadata.
4. Search by name, SKU and barcode; verify organisation-scoped results.
5. Archive and reactivate the product; verify status filtering.
6. Add a variant with a unique variant code and barcode; list and archive it.
7. Export catalogue JSON, import a valid JSON rows payload, and verify row-level errors for duplicate SKU/barcode.
8. Set an outlet price using the existing price endpoint; supersede it with a new price and verify the history endpoint returns both effective periods.
9. Attempt duplicate SKU/barcode and cross-organisation category/brand/product IDs; expect conflict/not-found responses and no data leakage.
10. Verify checkout still resolves server-authoritative outlet prices; variant-aware checkout is not yet enabled.

## Safety

Do not enable live alcohol commerce based only on catalogue setup. Licence approval, excise controls, tax treatment, payment certification and outlet authorisation remain independent release gates.
