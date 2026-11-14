# P537 Runbook

1. Configure the P536 environment and PostgreSQL connection as described in the root runbook.
2. Install workspace dependencies using the repository's lockfile/package workflow.
3. Run `npm run db:migrate` from the repository root to apply migration 239.
4. Start API and web using `npm run dev`.
5. Sign in as a buyer organisation with `trade:read` and `trade:manage`; establish an approved supplier relationship and use the Trade Partners workspace.
6. Sign in as the supplier organisation to review and progress orders.
7. Submit dispatch evidence as supplier and buyer receipt/exception evidence as buyer. Verify evidence visibility to both participants.
8. Do not interpret receipt evidence as a GRN or inventory/accounting posting.

Pre-release required: PostgreSQL clean-install and upgrade tests, role/tenant isolation tests, browser E2E, API integration and operational UAT.
