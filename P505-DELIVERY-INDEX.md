# P505 Delivery Index

- `P505-IMPLEMENTATION.md` — scope and commands.
- `P505-TEST-PLAN.md` — tests and execution requirements.
- `P505-RELEASE-READINESS.md` — remaining release gates.
- `P505-DELIVERY-REPORT.md` — verified and unverified status.
- `scripts/verify-p505-env.mjs` — local environment preflight.
- `scripts/verify-p505-postgres.mjs` — isolated live PostgreSQL migration integration test.
- `scripts/verify-p505-release.mjs` — inherited static release checks.

Run `npm run verify:p505:release` for static/inherited checks. Run `npm run verify:p505:postgres` only after configuring a disposable PostgreSQL admin connection.
