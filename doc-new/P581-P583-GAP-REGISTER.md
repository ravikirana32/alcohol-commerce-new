
# P581–P583 Cumulative Gap Register Addendum

## P581 — Reporting and BI governance
**Implemented:** saved report definitions; five supported report types; pause/archive lifecycle; schedule metadata and cron syntax validation; tenant-scoped execution evidence; SHA-256 payload integrity evidence; bounded JSON evidence export.

**Open gaps:** scheduled job runner and timezone/DST execution; CSV/XLSX/PDF renderers; report parameter schema validation against each report's real query; dashboard UI and drill-downs; cross-outlet consolidation with elimination rules; report snapshot reproducibility/versioned query definitions; finance-approved reconciliation of gross POS figures to posted GL revenue; email/storage delivery integrations; report row-level data classification and retention policy; runtime and browser acceptance.

## P582 — Provider adapters and certification
**Implemented:** provider event contract assessment for accounting export, ERP, delivery, CRM, data warehouse and custom; HTTPS scheme check; URL credential rejection; obvious localhost/local destination rejection; event allowlist; idempotency key validation; payload hash; tenant-scoped certification evidence/history. Dispatch is explicitly disabled.

**Open gaps:** DNS resolution and rebinding-resistant egress allowlist; complete IPv4/IPv6 private/link-local/multicast/reserved address blocking; redirect blocking; network-layer egress proxy; TLS pinning/certificate policy; provider-specific OAuth/API-key/signature adapters; signed canonical payloads; real provider sandbox certification; durable leased worker, bounded retries/backoff, dead-letter queue, replay and operator controls; delivery receipts and reconciliation; secret vault integration/rotation; outbound dispatch security review and production approval.

## P583 — Security and reliability hardening
**Implemented:** PostgreSQL-backed atomic shared auth rate-limit bucket; hashed path/IP key; fail-closed response when limiter storage is unavailable; append-only database trigger for security audit rows; expiry index for rate-limit bucket cleanup.

**Open gaps:** rate-limit bucket cleanup job and retention controls; gateway/WAF controls and trusted-proxy/IP spoofing review; per-account/device/IP adaptive throttles and distributed denial-of-service controls; database performance/load and lock-contention testing; audit coverage completeness and bypass review; audit partitioning, retention/legal hold and external SIEM export; encryption/key rotation review; secrets management; penetration testing, tenant IDOR matrix, dependency/container scans, backup/restore and multi-zone failover drills; operational alerts and SLO validation.

## Cross-phase runtime and acceptance gaps
PostgreSQL migrations were not executed in this environment. Docker and `psql` are unavailable. API semantic typecheck is blocked by missing workspace dependencies/type packages (`@types/node`, `pg`, `vitest`). TypeScript syntax transpilation passed, but this is not equivalent to a semantic typecheck. API integration, UI/mobile E2E, concurrency, load, provider sandbox, security penetration testing, finance/legal UAT and pilot sign-off remain NOT RUN. Production remains NO-GO.

## Safety gates retained
- Live payment capture remains disabled.
- Outbound provider dispatch remains disabled.
- Offline alcohol financial posting remains disabled.
- No statutory tax/excise rates are asserted as legally approved by this release.
