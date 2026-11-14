# P552 Runbook — API Permission Parity

## Regenerate migration-derived role permissions

From the repository root:

```bash
npm run generate:p552:permissions
```

This scans `apps/api/src/db/*.sql` for literal role/permission tuples and SQL `SELECT role_code, 'permission' FROM (VALUES ...)` grants. Review the diff before committing generated output.

## Run static API route parity audit

```bash
npm run verify:p552
```

The command writes `P552-API-ROUTE-PERMISSION-MATRIX.json` with route method, path, direct permission middleware, inherited router permission middleware and any explicit exemption rationale.

## Verify adjacent authorization baselines

```bash
node scripts/verify-p549-permissions.mjs
node scripts/verify-p550-actions.mjs
node scripts/verify-p551-workspace-actions.mjs
node scripts/verify-p548.mjs
node scripts/verify-p547-rbac.mjs
```

## Runtime validation on a Docker/PostgreSQL host

1. Start the environment and apply migrations using the existing deployment runbook.
2. Run `npm run db:status` and confirm every migration is applied.
3. Run the opt-in demo seeder using the P546 runbook. Keep `DEMO_SEED_ENABLED` disabled outside disposable development databases.
4. Authenticate as each seeded role and capture `/api/v1/auth/me` and `/api/v1/tenant/context` permission arrays.
5. For each route in `P552-API-ROUTE-PERMISSION-MATRIX.json`, test a permitted role (expect normal route response) and a denied role (expect 403); unauthenticated protected requests should return 401.
6. Repeat with another organisation, outlet and resource identifier. Verify foreign resources are denied without leaking existence or data.
7. Run API tests and browser journeys with installed dependencies; retain raw logs and request IDs.

## Exemption review

The 11 exemptions are documented in the generated matrix. Re-review public health/metadata endpoints, login/bootstrap, webhook signature handling, invitation token acceptance and authenticated self-service endpoints whenever their behavior changes. Do not remove a permission guard to make a test pass.

## Security note

The generated matrix is static source evidence only. It does not query the live PostgreSQL database and does not prove route-level data ownership checks. Never enable live payment capture, offline alcohol posting or provider dispatch based solely on this report.
