# P518 Runbook

1. Unzip the cumulative release and configure `.env` using `.env.example` / `.env.docker.example`.
2. Start PostgreSQL and other dependencies using the repository Docker Compose instructions.
3. Apply ordered migrations using the project's migration runner (`npm run db:migrate`, where configured). Migration `220_p518_inventory_warehouse.sql` creates transfer, batch and stocktake tables.
4. Start API and web applications using the root scripts documented in `README.md`.
5. Sign in as an organisation user with the appropriate inventory permissions.
6. Create a transfer between two outlets. Dispatch it, then confirm receipt. For a shortage, call the receive API with a reason for each short line.
7. Start a stocktake, retrieve its detail, update counted quantities, submit, then approve with a reason. If stock changed after snapshot, approval returns `STOCK_CHANGED_DURING_COUNT`; create a new count.
8. Register batches through `POST /api/v1/inventory/batches`; inspect expiry visibility through `GET /api/v1/inventory/batches?outletId=<uuid>&expiringWithinDays=90`.

## Verification
- `npm run verify:p518`
- `npm run verify:p517` and earlier cumulative phase verifiers.
- `node scripts/check-typescript-syntax.mjs`
- `python3 scripts/verify-migrations.py`

Live PostgreSQL migration, API integration, browser E2E, concurrency and security testing are still required before production use.
