# Runbook P46–P75

1. Extract the latest cumulative ZIP.
2. Copy `.env.example` to `.env`; configure database URL, strong JWT secrets and allowed web origins.
3. Start local dependencies with `docker compose up -d --build`.
4. Install dependencies using `npm install`.
5. Apply migrations with `npm run db:migrate`.
6. Run `python3 scripts/audit-repository.py`.
7. Run `npm run typecheck`, `npm run test` and `npm run build`.
8. Verify API health at `/api/health/live`.
9. Test tenant isolation with at least two organisations and multiple outlets.
10. Complete the P46–P75 phase acceptance checklists.

Before production: validate a fresh install and P45 upgrade, test all retail/bar workflows, verify peg millilitre accounting, run offline replay/concurrency tests, complete security review and obtain jurisdiction-specific legal/excise sign-off. Maintain verified backups and a rollback/forward-fix plan.
