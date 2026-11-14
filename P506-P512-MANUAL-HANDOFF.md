# Manual Handoff — P506 through P512

1. Use P512 cumulative ZIP as the latest source; do not merge multiple cumulative ZIPs over one another.
2. Extract and open PowerShell in the `source` directory.
3. Install Node.js 20.18+ and npm 10.8+, Docker Desktop and WSL2 if using Windows.
4. Run `npm install`.
5. Copy `.env.docker.example` to `.env` only if the startup script does not create it; set strong local-only secrets.
6. Run `.\scripts\start.ps1`.
7. Check `docker compose ps` and `docker compose logs --tail=200 migrate api web`.
8. Run `npm run verify:p505:release`, `npm run verify:p506:static`, `npm run verify:p507:static`, `npm run verify:p508:static`, `npm run verify:p509:static`, `npm run verify:p510:static`, `npm run verify:p511`, `npm run verify:p512`.
9. Run `npm run verify:p505:postgres` with TEST_DATABASE_ADMIN_URL pointed at a disposable PostgreSQL admin database.
10. Install Playwright Chromium with `npx playwright install chromium`; run `npm run test:e2e`.
11. Run `npm run typecheck`, `npm run build`, and `npm test`. Save full logs and send failures for remediation.

Do not use production/customer data or production secrets in test environments. Do not enable live payments, consumer discovery or offline sync for alcohol transactions without legal and technical approvals.
