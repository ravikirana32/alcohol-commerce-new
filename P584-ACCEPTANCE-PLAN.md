# P584 — End-to-End, UAT and Business Acceptance

## Acceptance workstreams
1. Environment and migration: clean database bootstrap, forward migration replay, checksum verification and backup before upgrade.
2. Identity and access: seeded demo roles, login/refresh/logout, permission allow/deny, tenant/outlet/resource IDOR negative tests.
3. Retail POS: catalogue, cart, tax quote, checkout, tender allocation, receipt, refund, stock ledger and FIFO valuation.
4. Bar POS: table/ticket lifecycle, measure validation, tax snapshot, payment, close, inventory/peg movement and reconciliation.
5. Procurement: supplier, PO, partial GRN, accepted/rejected quantities, FIFO layer, supplier return and AP evidence.
6. Finance: journals, trial balance, P&L, balance sheet, cash-flow limitations, settlement matching and period close blockers.
7. Regulatory: licence and dry-day rules, decision evidence, report traceability and lot/expiry checks.
8. Device/offline: enrollment/trust, queue ordering, sync idempotency, conflict recovery, checkpoint monotonicity and no unauthorised alcohol financial posting.
9. Integrations: outbox creation, adapter assessment, tenant isolation, provider dispatch hard-disabled.
10. Security/reliability: rate limit across API instances, append-only audit, secret handling, backup/restore, load and failover.
11. Accessibility and usability: keyboard navigation, focus, responsive layout, error recovery and supported mobile device checks.

## Execution contract
- Each test must record environment, build SHA, migration set/checksum, actor role, organisation/outlet, input fixture, expected result, actual result, timestamp and evidence link.
- Positive tests must be paired with negative/permission/tenant-boundary tests.
- Monetary assertions use decimal-safe comparisons and approved rounding fixtures.
- Run against disposable, anonymised test data. Never use live payment credentials.
- Mark a test PASS only after an actual runtime execution and retained evidence. Source-level assertions are not runtime acceptance.

## P584 status
Acceptance specifications and evidence templates are prepared. The current workspace has no Docker or PostgreSQL executable and lacks installed workspace dependencies. Therefore database, API, browser/mobile, load, security and business UAT execution is NOT RUN. P584 cannot be declared accepted.
