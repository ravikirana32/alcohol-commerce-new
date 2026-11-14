# P581–P583 Implementation Report

## P581 — Reporting and BI governance
- Added tenant-scoped saved report definitions for sales overview, sales trend, top products, inventory movements and finance P&L.
- Added status lifecycle (active, paused, archived), five-field cron syntax validation and timezone metadata.
- Added immutable execution evidence with SHA-256 result hashes and bounded evidence listing.
- Export evidence endpoint accepts bounded JSON row payloads and records their digest.
- Existing operational and finance reports remain distinct: gross POS metrics are not represented as accounting revenue.
- Scheduled report execution, timezone-aware scheduler, CSV/XLSX/PDF rendering, dashboard UI, cross-outlet consolidation and finance reconciliation remain gaps.

## P582 — Provider adapters and certification
- Added provider event contract registry for accounting export, ERP, delivery, CRM, data warehouse and custom adapters.
- Added HTTPS endpoint assessment, rejection of URL credentials and obvious loopback/local destinations, supported-event validation, idempotency-key validation and payload hashing.
- Added tenant-scoped certification evidence and assessment history.
- No outbound HTTP call is made. Dispatch remains hard-disabled; DNS rebinding/private-network egress defence, signed payloads, provider-specific auth/signatures, real retry worker, DLQ/replay and sandbox certification remain gaps.

## P583 — Security and reliability hardening
- Replaced process-local auth attempt counters with an atomic PostgreSQL shared-window bucket keyed by SHA-256 path/IP digest.
- Fail-closed behavior returns 503 if the shared limiter is unavailable.
- Added expiry index for bucket cleanup and append-only trigger preventing update/delete of security audit rows.
- Distributed rate-limit deployment needs database load/retention validation; gateway-level abuse controls, IPv6/proxy trust review, partitioning/retention, audit coverage completeness, external SIEM, penetration test and restore/failover tests remain gaps.

## Verification boundary
Static source verifiers and TypeScript syntax transpilation can be run without a live database. PostgreSQL migration execution, semantic TypeScript typecheck, API integration, browser/mobile E2E, load, concurrency, provider sandbox, penetration testing and UAT require a provisioned runtime and are not claimed as passed.
