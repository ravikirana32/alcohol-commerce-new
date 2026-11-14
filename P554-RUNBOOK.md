# P554 Runbook

From the repository root:

```bash
npm ci
npm run verify:p554
npm run test:authorization:p554
```

The matrix test runs the Express `requirePermission` middleware for every role and distinct permission in `apps/api/src/authz/permission-matrix.generated.json`. It injects a test-only identity; it does not log in through JWT/session endpoints.

For live database grant comparison, configure `DATABASE_URL` for a disposable/non-production PostgreSQL database and run:

```bash
npm run verify:p553:live
```

Do not use production credentials for test runs. Complete the P553 tenant-isolation plan and authenticated route tests separately before enabling production access.
