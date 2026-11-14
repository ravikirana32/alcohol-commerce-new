# P553 Runbook

## 1. Install dependencies
From repository root:

```bash
npm install
```

## 2. Run static verification

```bash
npm run verify:p553:static
npm run verify:p552
npm run verify:p551
npm run verify:p550
npm run verify:p549
npm run verify:p548
npm run verify:p547
npm run check:syntax
npm run verify:migrations
```

## 3. Compare live PostgreSQL role grants (read-only)
Use a non-production database that has completed the required migrations. Supply `DATABASE_URL` through your shell or secret manager; do not commit it to `.env` or paste it into logs.

```bash
DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require' npm run verify:p553:live
```

The script executes only `SELECT role_code, permission_code FROM role_permissions` inside a `BEGIN READ ONLY` transaction. It exits non-zero if the database has missing or unexpected role-permission pairs. It never auto-grants or modifies permissions. The sample URL above is a placeholder, not a credential.

## 4. Tenant/outlet isolation runtime tests
Follow `docs/security/P553-TENANT-ISOLATION-TEST-PLAN.md` using a disposable database with two organisations and multiple outlets. Use synthetic fixture UUIDs, test both allowed and denied operations, and retain redacted request/response plus database before/after evidence. Never run mutation fixtures against production.

## 5. Full application checks

```bash
npm run typecheck
npm run build
npm test
npm run test:e2e
```

These checks require installed dependencies and the documented test services. A passing static scan does not replace these runtime checks.

## Safety / release gate
Live payment capture, offline alcohol posting and outbound provider dispatch remain disabled. P553 is not production approval. Production remains NO-GO until all cumulative legal, finance, provider, hardware, security, performance, restore, UAT and pilot gates are evidenced and signed off.
