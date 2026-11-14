# P569 Release Notes — 0.569.0-dev

- Refund endpoints now require request idempotency headers.
- Identical refund retries return the existing refund; payload reuse conflicts return HTTP 409.
- Retail refund restock and outlet-transfer stock movements use the centralized append-once stock ledger service.
- Added migration 245 and static verification tooling.
- Client integrations must persist/reuse refund idempotency keys across retries.
- No live payment, offline alcohol posting, or outbound integration dispatch gates are changed.
- Not approved for production pending PostgreSQL, concurrency, E2E and security acceptance.
