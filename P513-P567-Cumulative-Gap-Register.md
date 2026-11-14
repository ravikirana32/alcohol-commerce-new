# Cumulative Gap Register — P513–P561

This register extends the P513–P559 cumulative register. All prior unresolved gaps remain open unless a phase report explicitly closes them.

## P560 — SQL Candidate Triage

**Status:** Static triage complete; live security acceptance open.

- 260 P559 candidates triaged: 1 global/reference/auth allowlist, 71 schema-unresolved, 188 tenant-bearing-table review.
- The 188 candidates are not confirmed vulnerabilities; each requires query-path, join, parent-ownership and runtime fixture review.
- No production SQL was modified.

### Open P560 actions
1. Trace candidate SQL through handlers, services, repositories, joins, transactions and background jobs.
2. Execute authenticated cross-organisation and cross-outlet denial tests using disposable PostgreSQL fixtures.
3. Verify nested child-resource ownership, exports and report scoping.
4. Run Playwright, penetration, backup/restore and production acceptance suites.

## Carried-forward production gates
- Live PostgreSQL migration and role-grant comparison.
- Authenticated API allow/deny matrix and cross-tenant/outlet IDOR tests.
- Full resource ownership review and SQL runtime verification.
- Tax/excise legal and finance approval; payment provider certification; accounting reconciliation.
- Hardware attestation, offline alcohol posting controls, integration egress/provider certification.
- Distributed rate limiting, complete audit coverage, backup/restore drills, load/failover and penetration tests.
- UAT, browser E2E and signed pilot/go-live acceptance.

**Release decision: NO-GO.**

## P561 — Tenant-scope remediation for selected high-risk updates

| ID | Finding / work item | Status |
|---|---|---|
| P561-01 | Bar KOT status mutation repeats organisation predicate | CLOSED — static source assertion |
| P561-02 | Offline recovery triage mutation repeats organisation predicate | CLOSED — static source assertion |
| P561-03 | Finance journal posting mutation repeats organisation predicate | CLOSED — static source assertion |
| P561-04 | Retail sale refund status mutation repeats organisation predicate | CLOSED — static source assertion |
| P561-05 | Outlet shift close mutation repeats organisation predicate | CLOSED — static source assertion |
| P561-06 | Runtime cross-organisation and cross-outlet tests for these paths | OPEN |
| P561-07 | Remaining P560 tenant-bearing-table review queue (188 candidates) | OPEN |
| P561-08 | Remaining P560 schema-unresolved review queue (71 candidates) | OPEN |
| P561-09 | Full SQL/ORM/background-job tenant ownership audit | OPEN |
| P561-10 | Independent penetration test and production security sign-off | OPEN |

P561 changes are defence-in-depth: each target row was already selected/created under organisation context in its transaction. The new predicates constrain the subsequent UPDATE independently. Static source assertions do not prove runtime DB isolation. Production remains NO-GO.


## P562 — Tenant-scope remediation for shift reconciliation reads

| ID | Finding / work item | Status |
|---|---|---|
| P562-01 | Retail tender aggregation constrains payment and sale organisation plus outlet | CLOSED — static source assertion |
| P562-02 | Bar tender aggregation constrains payment and ticket organisation plus outlet | CLOSED — static source assertion |
| P562-03 | Shift cash movement aggregation constrains organisation, outlet and shift | CLOSED — static source assertion |
| P562-04 | Retail and bar cash refund aggregation constrains organisation and outlet | CLOSED — static source assertion |
| P562-05 | Parameter bindings use authenticated organisation context | CLOSED — static source assertion |
| P562-06 | PostgreSQL reconciliation fixtures and cross-tenant/outlet runtime tests | OPEN |
| P562-07 | Remaining P560 tenant-bearing-table review queue (188 candidates) | OPEN |
| P562-08 | Remaining P560 schema-unresolved review queue (71 candidates) | OPEN |
| P562-09 | Full SQL/ORM/background-job ownership audit and Playwright acceptance | OPEN |
| P562-10 | Independent penetration test and production security sign-off | OPEN |

P562 is a narrow source-level remediation of eight SELECT statements across shift preview and close reconciliation. Static checks do not establish runtime database isolation. Production remains NO-GO.


## P563 — Inventory & procurement tenant predicate hardening

| ID | Finding / work item | Status |
|---|---|---|
| P563-01 | Inventory balance product join matches stock balance organisation | CLOSED — static source assertion |
| P563-02 | Inventory batch product join matches batch organisation | CLOSED — static source assertion |
| P563-03 | Stock transfer list outlet joins match transfer organisation | CLOSED — static source assertion |
| P563-04 | Stock transfer detail child lines join through organisation-scoped parent and same-org product | CLOSED — static source assertion |
| P563-05 | Purchase order supplier and approval joins match parent organisation | CLOSED — static source assertion |
| P563-06 | Purchase-order line existence and receipt-line lookups bind to organisation-scoped parent | CLOSED — static source assertion |
| P563-07 | Goods receipt remainder query and purchase-order status update repeat organisation scope | CLOSED — static source assertion |
| P563-08 | PostgreSQL clean-install and runtime inventory/procurement tests | OPEN |
| P563-09 | Authenticated cross-organisation/outlet and foreign child-ID tests | OPEN |
| P563-10 | Concurrent receipt/transfer posting, Playwright and penetration acceptance | OPEN |
| P563-11 | Remaining P560 review queues (188 tenant-bearing candidates; 71 schema-unresolved) | OPEN |

P563 hardens selected inventory and procurement reads using organisation predicates derived from authenticated context and tenant-owned parent records. Static source assertions do not prove runtime isolation, referential integrity or concurrency safety. Production remains NO-GO.

## P564 — Tenant-safe transfer, receipt and stock mutations

| ID | Gap / control | Status | Evidence / notes |
|---|---|---|---|
| P564-01 | Outlet transfer source stock debit repeats organisation/outlet/product scope and checks affected row | CLOSED — static source assertion | `ecosystem.ts`; runtime concurrency test pending |
| P564-02 | Outlet transfer state and child-line mutations bind to organisation-scoped parent | CLOSED — static source assertion | `ecosystem.ts` |
| P564-03 | Stock transfer child-line dispatch/receipt updates bind to organisation-scoped parent | CLOSED — static source assertion | `operations.ts` |
| P564-04 | Stock transfer state updates repeat organisation scope | CLOSED — static source assertion | `operations.ts` |
| P564-05 | Stock balance conflict updates reject cross-organisation conflicting rows in touched flows | CLOSED — static source assertion | Operations, ecosystem and procurement paths |
| P564-06 | Purchase-order submit/reject and approval mutations repeat organisation scope | CLOSED — static source assertion | `procurement.ts` |
| P564-07 | PO line receipt mutation is bound to requested organisation-owned PO | CLOSED — static source assertion | `procurement.ts` |
| P564-08 | Goods receipt posting repeats organisation scope | CLOSED — static source assertion | `procurement.ts` |
| P564-09 | PostgreSQL clean-install and live mutation tests | OPEN | Not run in this environment |
| P564-10 | Concurrent transfer/receipt, duplicate movement and negative-stock tests | OPEN | Requires disposable PostgreSQL and authenticated API |
| P564-11 | Cross-organisation/outlet foreign child-ID tests | OPEN | Requires runtime fixtures and sessions |
| P564-12 | Playwright, penetration and production security acceptance | OPEN | Not run; production NO-GO |
| P564-13 | Inherited P560 SQL review queues | OPEN | Previously reported 188 tenant-bearing candidates and 71 schema-unresolved candidates; require continued triage |

P564 strengthens selected write paths but does not establish end-to-end tenant isolation or accounting/inventory consistency without runtime acceptance. Production remains NO-GO.

## P565 — Inventory ledger integrity and stock movement reconciliation

| ID | Gap / control | Status | Evidence / notes |
|---|---|---|---|
| P565-01 | Read-only diagnostics detect stock movement rows whose outlet/product organisation differs from movement organisation | CLOSED — static SQL review | `scripts/p565-stock-ledger-reconciliation.sql`; query not executed against live PostgreSQL |
| P565-02 | Read-only diagnostics detect stock balance rows whose outlet/product organisation differs from balance organisation | CLOSED — static SQL review | Same diagnostic script |
| P565-03 | Duplicate document/product/type movement references are reported for manual review | CLOSED — static SQL review | No unique constraint added because split/partial movements may be legitimate |
| P565-04 | Balance-to-movement reconciliation candidates are reported | CLOSED — static SQL review | Opening balances and adjustment semantics mean differences are not automatically defects |
| P565-05 | Inventory batch receipt-to-movement reconciliation candidates are reported | CLOSED — static SQL review | Historical batch paths may not be one-to-one |
| P565-06 | Existing receipt, adjustment, goods receipt, refund and offline paths statically checked for movement writes | CLOSED — 11/11 source assertions | Does not prove every stock mutation in the entire codebase is ledger-backed |
| P565-07 | PostgreSQL execution of reconciliation diagnostics and fixture-based expected results | OPEN | Requires disposable/staging PostgreSQL |
| P565-08 | Idempotency guarantees for all stock movement posting paths | OPEN | No global idempotency key exists across all legacy reference types; duplicate candidates require workflow-by-workflow review |
| P565-09 | Opening balance import/cutover baseline and movement sign semantics | OPEN | Required before treating balance-vs-ledger deltas as accounting-grade reconciliation |
| P565-10 | Concurrent posting, retry, cross-tenant/outlet runtime tests, Playwright and penetration testing | OPEN | Not run; production remains NO-GO |
| P565-11 | Inherited P560 SQL review queues | OPEN | Previously reported 188 tenant-bearing candidates and 71 schema-unresolved candidates; continue triage |

P565 adds read-only reconciliation diagnostics and static source assertions. It does not add a global uniqueness constraint or mutate existing inventory data. Duplicate movement candidates and balance deltas require domain-aware review because partial receipts/transfers, opening balances and adjustments can produce legitimate non-one-to-one relationships. Production remains NO-GO.


## P566 — Inventory Movement Idempotency & Retry-Safe Posting

| ID | Gap / deliverable | Status | Notes |
|---|---|---|---|
| P566-01 | Source-event-line idempotency columns | Implemented | Nullable columns preserve existing movement history |
| P566-02 | Organisation/outlet-scoped unique key | Implemented | Partial unique index; legacy NULL keys remain valid |
| P566-03 | Stable payload fingerprint | Implemented | SHA-256 over organisation, outlet, product, type, quantity and reference |
| P566-04 | Append-once service helper | Implemented | Identical replay returns existing movement; changed payload conflicts |
| P566-05 | Unit regression tests | Authored; execution pending | Vitest tests added |
| P566-06 | Adoption by retail/bar/transfer/receipt/refund/offline workflows | OPEN | Must be integrated workflow by workflow |
| P566-07 | PostgreSQL clean-install/upgrade migration execution | OPEN | Not executed in this environment |
| P566-08 | Concurrent duplicate-posting runtime tests | OPEN | Requires disposable PostgreSQL |
| P566-09 | Full tenant/outlet IDOR and browser acceptance | OPEN | Carry-forward security gate |
| P566-10 | Production security and operational sign-off | OPEN | Production remains NO-GO |

### P566 design note
The idempotency identity is per source event line, not per document. This avoids incorrectly collapsing legitimate partial receipts, split transfers, or multiple product lines. The helper only appends `stock_movements`; balance mutation and source document state remain the caller's responsibility inside the same transaction.


## P567 — Stock Movement Idempotency Workflow Integration

| ID | Workflow / acceptance item | Status | Notes |
|---|---|---|---|
| P567-01 | Retail checkout movement append-once | Implemented | Sale ID + line index |
| P567-02 | Bar checkout movement append-once | Implemented | Ticket ID + line index |
| P567-03 | Offline retail and bar movement append-once | Implemented | Source event ID + line index |
| P567-04 | Transfer dispatch and receipt movement append-once | Implemented | Transfer line ID + direction |
| P567-05 | Stocktake approval movement append-once | Implemented | Stocktake line ID |
| P567-06 | Inventory batch receipt movement append-once | Implemented | Batch ID |
| P567-07 | Goods receipt movement append-once | Implemented | Persisted receipt-line ID |
| P567-08 | Manual stock receipt endpoint | OPEN | Needs stable client/source idempotency key |
| P567-09 | Manual stock adjustment endpoint | OPEN | Needs stable client/source idempotency key |
| P567-10 | Open-bottle source movement | OPEN | Needs stable opening event identity |
| P567-11 | Goods receipt request-level replay | OPEN | New receipt creation on retry needs request idempotency |
| P567-12 | Vitest, PostgreSQL and concurrent posting acceptance | OPEN | P566 Vitest attempt blocked by executable permission; runtime not run |
| P567-13 | Tenant/outlet IDOR, Playwright and penetration testing | OPEN | Production security gate |

### P567 design note
The helper is invoked inside the existing transaction and does not mutate stock balances. Movement-level replay protection is not equivalent to end-to-end API request idempotency. Goods receipt request replay and the manual receipt/adjustment/open-bottle APIs remain incomplete.

## P568 — Complete Stock Movement Idempotency & Concurrency Protection

| ID | Gap / acceptance item | Status | Notes |
|---|---|---|---|
| P568-01 | Manual stock receipt request idempotency | Implemented — static verified | Requires `Idempotency-Key`; balance increments only when append-once movement is created |
| P568-02 | Manual stock adjustment request idempotency | Implemented — static verified | Signed delta included in movement fingerprint; replay returns before applying delta |
| P568-03 | Open-bottle opening request idempotency | Implemented — static verified | Stable key maps to source movement and original bottle; balance debited only on first request |
| P568-04 | Goods receipt request-level idempotency | Implemented — migration/static verified | Migration 244 persists key/fingerprint and unique org/outlet scope; identical replay returns original receipt |
| P568-05 | Changed-payload key reuse rejection | Implemented — static verified | Movement helper and goods-receipt fingerprint reject changed payloads |
| P568-06 | Client rollout for Idempotency-Key headers | OPEN | Update web/POS clients; preserve key across network retries |
| P568-07 | PostgreSQL migration execution and transactional replay tests | OPEN | Docker/PostgreSQL unavailable in this environment |
| P568-08 | Concurrent same-key/same-payload and same-key/different-payload tests | OPEN | Requires staging PostgreSQL and parallel HTTP requests |
| P568-09 | Vitest and semantic TypeScript typecheck | OPEN | Vitest and workspace dependencies/types not installed in this environment |
| P568-10 | Refund and legacy ecosystem stock movement request-level audit | OPEN | `settlements.ts` and `ecosystem.ts` need dedicated source identity and balance coupling review |
| P568-11 | Tenant/outlet IDOR, browser E2E, penetration, load/failover | OPEN | Production security/operational gate |

### P568 design note
P568 protects the balance/source mutations as well as the stock movement append for the targeted workflows. It requires client-generated stable keys on the four request types. The goods receipt endpoint locks the purchase order before checking its request key, so concurrent receipt attempts for the same PO serialize. Static assertions and migration review pass, but database execution and concurrent runtime tests remain outstanding. Production remains NO-GO.
