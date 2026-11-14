# P542 Runbook

1. Configure `.env` from `.env.example` and provision an isolated PostgreSQL test database.
2. Install workspace dependencies with `npm install`.
3. Apply migrations using `npm run db:migrate`.
4. Start services using `npm run dev` (or use the Playwright webServer configuration).
5. Run static coverage: `npm run verify:p542`.
6. Run browser/API acceptance: `npm run test:e2e:p542`.
7. Retain Playwright HTML report, traces, screenshots and database migration logs.
8. Do not use production credentials or enable live payment/offline alcohol posting for test runs.
