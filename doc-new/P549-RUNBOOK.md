# P549 Runbook — Permission Matrix & Demo Role Validation

## 1. Install and start

From the extracted project root:

```bash
npm install
# Configure local .env and database as described in P546-RUNBOOK.md
 docker compose up -d --build
npm run db:migrate
npm run db:seed:demo
```

Demo seeding is for a disposable local development database only. Set `DEMO_SEED_ENABLED=true` and a strong `DEMO_SEED_PASSWORD` as documented in P546-RUNBOOK.md. Never use demo seed credentials in production.

## 2. Run static permission checks

```bash
npm run verify:p549
npm run check:syntax
npm run verify:migrations
```

The generated matrix at `apps/api/src/authz/permission-matrix.generated.json` is derived from literal SQL migration inserts. It is not a live database snapshot.

## 3. Compare actual PostgreSQL grants

Run this against the configured local database:

```sql
SELECT role_code, permission_code
FROM role_permissions
ORDER BY role_code, permission_code;
```

Compare the result with `apps/api/src/authz/permission-matrix.generated.json`. Investigate every difference; do not automatically overwrite live grants from the generated file.

## 4. Test every seeded account

Use the role email list and shared locally configured `DEMO_SEED_PASSWORD` in P546-RUNBOOK.md. For each account:

1. Sign in through `http://localhost:5173`.
2. Call `GET /api/v1/auth/me` with its bearer token and record `roleCode`, `organisationId`, `outletIds` (if returned) and `permissions`.
3. Select one allowed operation and verify success.
4. Select one forbidden operation and verify `403`.
5. Repeat against a different organisation/outlet resource and verify denial.
6. Sign out and verify the token is no longer accepted.

Do not assume the role name alone defines permissions. The returned permission grants and backend route middleware are the source of authorization.

## 5. Focused API tests

```bash
npm run test:permissions:p549
```

This command is provided but was not executed in the build environment. Capture the actual Vitest output before closing the runtime gap.

## 6. Important limitations

The P549 action policy is a reusable frontend policy catalogue. It is not yet wired to every action in every workspace component. UI checks are not a security boundary; API middleware must independently enforce each operation. Do not treat static verifier success as release approval.
