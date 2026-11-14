# P579–P580 Runbook

1. Start the project's local stack using the root `docker-compose.yml` and `.env` based on `.env.example` (see the existing project runbook for environment setup).
2. Back up the development database before migration.
3. From the repository root, run `docker compose up -d --build`.
4. Run migrations in the API container: `docker compose exec api npm run db:migrate` (service name may differ in a local compose override; check `docker compose ps`).
5. Verify API readiness: `curl -fsS http://localhost:8080/api/health/ready`.
6. Run static checks from the repository root:
   - `node scripts/check-typescript-syntax.mjs`
   - `node scripts/verify-p579-regulatory-traceability.mjs`
   - `node scripts/verify-p580-device-offline-operations.mjs`
   - `node scripts/verify-p575-inventory-costing.mjs`
   - `node scripts/verify-p576-procurement-completion.mjs`
   - `node scripts/verify-p577-settlement-reconciliation.mjs`
   - `node scripts/verify-p578-financial-statements.mjs`
7. API routes are under `/api/v1`. Authenticate and include the organisation context required by the existing API middleware.
8. Enrol and cryptographically attest a device through the existing `/devices` challenge/attest flow before posting device health to `/devices/:deviceId/health`.
9. Offline sync checkpoints are created by `/offline/sync-batches`; read them with `/offline/checkpoints`.
10. Do not enable offline posting, live payment capture or outbound integration dispatch for production until all acceptance gates in the cumulative gap register are closed.

The container command and health port must be checked against the active compose file. Runtime execution was not performed as part of this source delivery.
