# P530 Runbook

1. Configure the existing P529 environment and PostgreSQL connection using `.env.example`.
2. Install dependencies from the repository root (`npm ci`) in a supported Node/npm environment.
3. Apply migrations: `npm run db:migrate`.
4. Start API and web: `npm run dev`.
5. Ensure the outlet and organisation are ACTIVE, a current verified retail licence exists, retail price book and stock are configured, and the offline event has passed P527/P528 and P529 approval.
6. Submit `POST /api/v1/offline/posting-intents/{intentId}/post` using a user granted `offline:ledger-post`.
7. Inspect `GET /api/v1/offline/posting-executions` and reconcile sale, stock movement and payment evidence.

Do not enable for production until PostgreSQL integration/concurrency tests, journal/COGS automation (P536), tax review and legal approval are complete. Bar checkout is deliberately rejected by P530.
