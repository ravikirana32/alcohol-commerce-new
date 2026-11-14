# P584–P585 Runbook

## Local setup
1. Extract the cumulative ZIP.
2. Copy `.env.example` to `.env`; set disposable local credentials and PostgreSQL configuration.
3. Start dependencies: `docker compose up -d --build`.
4. Install dependencies: `npm ci` (or `npm install` if no lockfile).
5. Run migrations: `npm run db:migrate`.
6. Start API and web: `npm run dev`.

## Static release checks
- `npm run verify:p584`
- `npm run verify:p585`
- `npm run check:syntax`
- `npm run verify:p579-p580:migrations`

## Runtime smoke test
Start the API and execute:
`P584_BASE_URL=http://localhost:8080 node scripts/run-p584-runtime-smoke.mjs`

This checks liveness, readiness, API metadata version and confirms live payment mode is not enabled. It does not replace authenticated end-to-end or business acceptance.

## Acceptance evidence
Populate `../reports/P584-EVIDENCE-TEMPLATE.json` only after actual test execution. Retain logs, screenshots/video, request IDs, test data identifiers, build SHA and migration checksum. Do not mark NOT_RUN tests as PASS.

## Production gate
Review `../reports/P585-PRODUCTION-RELEASE-GATES.json`. Every mandatory gate must be PASS with independently reviewable evidence and accountable approval. Current decision is NO_GO. Never edit the decision to GO merely to bypass the gate.
