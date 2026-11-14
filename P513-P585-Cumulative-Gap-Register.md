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

## P569 — Refund Idempotency & Stock-Write Audit

| ID | Finding / work item | Status |
|---|---|---|
| P569-01 | Retail refund request-level idempotency key and payload fingerprint | CLOSED — source/static assertion; runtime DB acceptance open |
| P569-02 | Bar refund request-level idempotency key and payload fingerprint | CLOSED — source/static assertion; runtime DB acceptance open |
| P569-03 | Identical refund replay returns original result; changed payload conflicts | CLOSED — source/static assertion; concurrent PostgreSQL test open |
| P569-04 | Retail refund restock movement uses append-once ledger helper | CLOSED — source/static assertion |
| P569-05 | Outlet-transfer dispatch/receipt use stable line-level append-once keys | CLOSED — source/static assertion |
| P569-06 | Direct stock movement inserts outside centralized helper | CLOSED — static source audit finds one insert site in helper |
| P569-07 | PostgreSQL migration execution, concurrent retry and rollback tests | OPEN |
| P569-08 | API/browser E2E, tenant/outlet IDOR and penetration testing | OPEN |

### P569 client compatibility
Both retail and bar refund POST endpoints now require `Idempotency-Key` (16–120 characters). Clients must reuse the same key and payload for retries. Changed payload under the same key returns HTTP 409. Historical refund rows remain compatible because migration columns are nullable.

### P569 carried-forward gaps
- P568 manual receipt/adjustment/open-bottle/goods-receipt retry protections require PostgreSQL concurrency and runtime validation.
- Vitest and semantic typecheck have not been verified in this environment.
- P560 SQL ownership review, role/API runtime matrix, tenant/outlet IDOR, Playwright, penetration, backup/restore, load/failover and pilot sign-off remain open.
- Statutory tax/excise approval, payment provider certification, accounting reconciliation, hardware attestation, offline alcohol posting controls and integration egress/provider certification remain open.

**Release decision: NO-GO.**

## P570 — Stock Ledger Reconciliation & Integrity Exceptions

| ID | Work item | Status | Notes |
|---|---|---|---|
| P570-01 | Organisation/outlet-scoped reconciliation run and exception schema | Implemented — migration static verified | Migration 246; PostgreSQL execution open |
| P570-02 | Compare active-product stock balances with classified movement totals | Implemented — static verified | Read-only service; no stock mutation |
| P570-03 | Detect balance variance, missing balance row and negative balance | Implemented — static verified | Exceptions are investigation signals, not automatic corrections |
| P570-04 | Detect adjustment movements with unknown sign | Implemented — static verified | Legacy ADJUSTMENT rows store positive quantity without sign; excluded from arithmetic |
| P570-05 | Reconciliation run history and exception listing | Implemented — static verified | Organisation/outlet filters |
| P570-06 | Controlled exception status and resolution notes | Implemented — static verified | Requires inventory:adjust; does not itself correct stock |
| P570-07 | Verified opening balance / migration baseline | OPEN | Pre-ledger stock must be established before variance is treated as definitive |
| P570-08 | Persist signed adjustment direction for new movements and migrate legacy history | OPEN | Schema/service contract change required; do not infer legacy sign |
| P570-09 | PostgreSQL migration and API integration/rollback tests | OPEN | Runtime not executed in this environment |
| P570-10 | Concurrent runs, tenant/outlet IDOR, browser E2E and penetration tests | OPEN | Security acceptance gate |
| P570-11 | Vitest and semantic TypeScript typecheck | OPEN | Workspace runtime dependencies not verified |

### P570 interpretation note
The reconciliation engine does not assume that the sum of all ledger movements equals current stock when an opening balance is absent. It flags unclassified adjustment records and documents the baseline limitation. It is intentionally read-only and never repairs stock automatically.

**Release decision: NO-GO.**

## P571 — Stock Ledger Foundation & Signed Adjustment Direction

**Implemented (static source):**
- Added `stock_movements.adjustment_direction` (`INCREASE` / `DECREASE`) for adjustment movements. New manual and stocktake adjustment paths persist the sign explicitly; the signed direction is included in the idempotency fingerprint.
- Added one-time organisation/outlet opening balance snapshots with immutable product-level quantity lines and actor/reason evidence.
- Reconciliation now starts from the captured opening quantity and applies subsequent inbound, outbound and signed adjustment movements. Legacy adjustments without a direction remain explicitly unclassified.
- Added `POST /inventory/opening-balance-snapshots` protected by `inventory:adjust`. It captures current stock balances once and does not mutate them.

**Open / acceptance required:**
1. Execute migration 247 against clean and upgraded PostgreSQL databases; verify existing legacy adjustments remain accepted and new adjustment inserts require direction.
2. Confirm all other adjustment writers and external import paths supply `adjustment_direction`; run a repository-wide and database-level audit.
3. Validate snapshot capture under concurrent stock writes. The outlet lock serializes snapshot creators, but all stock writers must follow compatible outlet/product locking for a consistent point-in-time baseline.
4. Validate arithmetic against controlled fixtures covering every movement type, opening balances, adjustments, transfer pairs, refunds, and historical cutover.
5. Add authenticated API tests for baseline permission, duplicate baseline rejection, cross-tenant/outlet access, and reconciliation variance correctness.
6. Decide the controlled process for correcting an incorrect opening baseline; current snapshot is immutable and requires a separately governed superseding-baseline design.
7. Vitest, semantic typecheck, PostgreSQL runtime, Playwright, concurrency, IDOR and penetration testing remain open.

**Release decision: NO-GO.** Static checks do not establish database/runtime correctness.


# P572–P574 additions (2026-11-10)

## P572 — Stock snapshot serialization
**Implemented:** advisory transaction lock shared by stock movement inserts and opening-balance capture; snapshot capture obtains lock before reading balances; PostgreSQL catalog acceptance script provided.

**Open / unverified:**
- PostgreSQL migration execution not run in this environment.
- Two-session lock ordering and transaction rollback behaviour need live database tests.
- Existing writers that mutate `stock_balances` without inserting `stock_movements` in the same transaction must be audited; advisory trigger only serializes ledger-backed movement transactions.
- Snapshot API/UI needs authenticated browser acceptance.

## P573 — Reconciliation cutoff integrity
**Implemented:** reconciliation now locks the outlet ledger scope, records a database cutoff timestamp and baseline snapshot ID, and limits movement arithmetic to that cutoff. Added indexes for reconciliation and legacy unsigned adjustment triage.

**Open / unverified:**
- Live PostgreSQL fixture tests for every movement type and timestamp boundary.
- Verify movement timestamps and transaction commit ordering under production isolation settings.
- Legacy unsigned adjustments require source-document evidence and a controlled historical remediation; no sign is inferred.
- Reconciliation exception status history is not yet a fully append-only event stream; current exception row stores latest status/reviewer fields.

## P574 — Variance correction workflow
**Implemented:** idempotent correction requests; maker-checker approval/rejection; database scope guard; signed append-once adjustment; atomic balance update; negative-stock prevention.

**Open / unverified:**
- Live concurrent approval/replay tests and DB constraint execution.
- Business UI for correction queue, evidence attachments, approval/rejection and audit history is not implemented in these phases.
- Approval permissions currently reuse `inventory:adjust`; a dedicated `inventory:variance-correct:approve` permission and role matrix review may be preferable before production.
- Rejection and approval reviewer audit should be expanded to a dedicated immutable event table.
- Request idempotency currently scopes the key to organisation/outlet, and route replay fingerprint protects changed payload; API-level concurrency tests remain open.
- Need authenticated role-based E2E, tenant/outlet IDOR, security and UAT acceptance.

## P572–P574 production gates
- PostgreSQL migration execution and clean-install/upgrade validation.
- Two-session advisory-lock tests for movement vs baseline and movement vs reconciliation.
- Concurrent correction approval and duplicate request tests.
- Vitest and semantic TypeScript typecheck.
- Browser E2E and UI workflow acceptance.
- Tenant/outlet/resource IDOR and penetration testing.
- Finance/operations approval of physical baseline and correction policy.

**Release decision remains NO-GO.** Static source checks do not constitute runtime or production acceptance.


# P575–P578 additions (2026-11-10)

## P575 — Inventory valuation and FIFO cost layers
**Implemented:** FIFO inventory cost layers; locked FIFO consumption rows and source-event idempotency; accepted goods receipts create cost layers; retail and bar checkout stock consumption allocates FIFO cost; manual receipts and inventory batches accept optional unit cost; unpriced receipts create visible cost exceptions; supplier returns consume FIFO cost; valuation and cost-exception read APIs.

**Open / partial:**
- Stock transfer dispatch/receipt does not yet carry FIFO layer cost allocations from source outlet to destination outlet.
- Opening-balance snapshot does not import independently verified opening unit costs; opening inventory remains unvalued until cost layers are loaded with evidence.
- Retail refund restocking does not yet restore original cost layer cost basis.
- Open-bottle/bar peg depletion and breakage costing need bottle/volume cost conversion and full reconciliation.
- COGS cost is allocated to source events, but automatic journal posting to the P536 COGS mapping is not wired into every sale/refund/transfer transaction.
- No landed-cost allocation for freight, duties or other procurement charges.
- Cost exception review/resolution UI and costing method approval (FIFO vs statutory/finance policy) remain open.
- Runtime valuation fixture tests and finance sign-off are not run.

## P576 — Procurement completion and supplier returns
**Implemented:** supplier return draft/list/approve/post endpoints; maker-checker approval; stock balance decrement and explicit `SUPPLIER_RETURN` movement; FIFO cost consumption evidence; partial GRN/accepted/rejected quantities and purchase order PART_RECEIVED/RECEIVED state retained; existing GRN idempotency preserved.

**Open / partial:**
- Supplier return posting is not yet integrated with supplier credit-note issuance, accounts payable settlement or automatic PURCHASE/REFUND journal posting.
- Supplier invoice three-way match runtime fixtures, discrepancy workflow and supplier credit note reconciliation remain to be accepted.
- Freight/landed costs and multi-currency supplier invoice handling are not implemented.
- Carrier tracking and proof-of-delivery runtime acceptance remain open.
- Procurement/supplier-return UI and authenticated browser E2E are not delivered in this grouped source phase.
- Supplier return and GRN PostgreSQL concurrency tests are not run.

## P577 — Refund, settlement and financial reconciliation
**Implemented:** bank statement line import with organisation/outlet validation and duplicate protection; manual settlement batch matching with amount variance; exact matches update settlement batch to BANK_CONFIRMED; chargeback case creation/list/status workflow; tenant/outlet validation for tender allocation references.

**Open / partial:**
- No direct bank feed/statement file parser, secure bank connector or bank account verification.
- Matching compares statement line amount and currency to settlement net amount/currency and enforces one bank statement line per settlement batch; reference/date matching and runtime validation remain open.
- Provider fee accounting and settlement journals are not automatically generated from every settlement batch.
- Chargeback outcomes do not yet automatically create accounting journals, tender lifecycle updates or refund reversals.
- Provider sandbox certification, live webhook end-to-end and bank reconciliation acceptance are open.
- UI, authenticated E2E, concurrency and security tests are not run.

## P578 — Financial statements and period close controls
**Implemented:** profit and loss, balance sheet (including current earnings in equity reconciliation), cash/bank movement report, inventory valuation and cost-exception APIs; non-postable/inactive accounts rejected by manual journal posting; period close check evidence records trial balance totals, individually unbalanced journal count, unresolved payment exceptions and unresolved cost exceptions; close blocked when checks fail.

**Open / partial:**
- Cash-flow endpoint is a direct cash/bank account movement summary, not a complete IAS/Ind AS indirect cash-flow statement with working-capital and non-cash adjustments.
- Financial statement mapping/classification, retained earnings opening balances, comparative periods, outlet consolidation and audit-ready statement exports need finance acceptance.
- Period close runtime validation, reversal workflow UI, locked-period negative tests and accounting source-to-journal completeness remain open.
- Existing automated accounting mappings require finance-approved chart of accounts and end-to-end source posting for each event type.
- No semantic TypeScript check, Vitest, PostgreSQL, browser E2E or finance UAT was run.

## P575–P578 production gates
- PostgreSQL migration clean install/upgrade and live data fixtures for FIFO, procurement, settlements, journals and statements.
- Concurrency tests for FIFO layer consumption, GRN retries, supplier return posting, bank matching and period close.
- Automatic COGS and supplier/settlement/refund accounting integration with approved mappings.
- Transfer/opening/refund/open-bottle cost basis completion and cost exception resolution.
- Full bank/provider certification, finance statement acceptance and audit exports.
- Browser E2E, tenant/outlet IDOR, penetration testing, load tests, backup/restore drills and legal/finance UAT.

**Release decision remains NO-GO.** Source-level implementation and static checks do not prove runtime accounting correctness or regulatory acceptance.

---

## P579 — Regulatory reporting and product-lot traceability (2026-11-10)

**Implemented in source:**
- Immutable report-run evidence with SHA-256 hash, row count, date range, organisation/outlet scope and creator.
- Excise decision, licence status, dry-day order and compliance exception report endpoints, plus report history.
- Product lot traceability links bind product, outlet, stock movement, lot, supplier reference, manufacture/expiry dates and quantity. The API verifies that the product and movement are in the organisation and same outlet/product before recording.
- Expiry-window, product, outlet and lot filters for traceability lookups.
- New permission codes and API permission gates; routes are mounted in the API.

**Remaining gaps / acceptance evidence required:**
- No dedicated web UI for regulatory report builder, traceability entry, lot search or recall workflow.
- Report payload is JSON; CSV/PDF export, scheduled delivery and regulator-specific statutory layouts are not implemented in this phase.
- Traceability links are manually recorded against existing stock movements; they are not yet automatically created by every GRN/transfer/return/production flow.
- No FEFO enforcement, lot-level stock decrement, automated quarantine/recall propagation or supplier-to-customer recall drill.
- Legal/regulatory review and confirmation of applicable statutory report formats remain external acceptance gates. No statutory rates/rules were invented or seeded.
- PostgreSQL migration execution, API integration tests, tenant/outlet negative tests and browser acceptance were not run in this environment.

## P580 — POS device operations and offline synchronisation controls (2026-11-10)

**Implemented in source:**
- Append-only device health evidence with health status, app/platform versions, battery, free storage, local-event timestamp and queue depth.
- Health reports are accepted only for an organisation-owned cryptographically TRUSTED device and organisation-owned outlet.
- Tenant-scoped latest-health query and role permission controls.
- Durable offline sync high-watermark checkpoint updated in the same database transaction as successful batch intake; high-watermark is monotonic and linked to the exact offline device, outlet and batch with composite foreign keys.
- Checkpoint read API and operational diagnostics; existing duplicate/conflict handling and sync audit are retained.
- Offline sales/checkouts remain quarantined for review; no financial or stock posting was enabled.

**Remaining gaps / acceptance evidence required:**
- `max_seen_sequence` is a maximum observed sequence, not a contiguous acknowledged cursor; missing sequence detection and gap-repair protocol remain to be implemented before clients may safely discard local events.
- No native iOS/Android/Windows/macOS device agent, signed heartbeat payload, hardware-backed attestation, secure clock, or device-specific encrypted local queue is delivered by these API/database changes.
- No UI dashboard for fleet health, offline queue review, conflict resolution or checkpoint inspection.
- No automated retention/alerting policy for stale devices, low battery/storage, prolonged offline periods or growing queues.
- Live PostgreSQL concurrency, network interruption/replay, device revocation during sync, browser/mobile E2E and penetration tests remain unrun.
- Offline alcohol sale posting remains disabled pending legal, device-attestation and end-to-end acceptance.

## Cumulative production gate after P580

**Status: NO-GO for production.** Static source checks passing does not prove deployed behaviour. Remaining critical gates include statutory/legal approval and tax configuration; finance-approved accounting and reconciliation; provider sandbox certification; hardware-backed device attestation; offline contiguous sequence/repair and business acceptance; full UI coverage; PostgreSQL migration/runtime tests; tenant/role/IDOR security tests; backup/restore, load/failover and penetration tests; and signed pilot/UAT approval. Live payment capture, outbound provider dispatch and offline alcohol financial posting remain disabled.


---


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


---

# P584–P585 Gap Register Addendum


## P584 — E2E, UAT and business acceptance
Implemented: comprehensive acceptance plan, evidence template, environment/build/migration/actor/tenant evidence fields, API health/readiness runtime smoke runner, and explicit rule that static checks are not runtime acceptance.
Open gaps: actual PostgreSQL migrations, semantic typecheck/build, authenticated API journeys, browser/mobile E2E, tenant/role/IDOR negative matrix, load/concurrency, penetration testing, accessibility acceptance, provider sandbox, backup/restore/failover, finance/legal UAT and pilot acceptance. All remain NOT_RUN or BLOCKED pending a provisioned environment and accountable testers.

## P585 — Pilot and production readiness
Implemented: 13 mandatory release gates with owners/evidence requirements, machine-readable NO_GO manifest, deployment checklist, abort criteria and rollback guidance. Existing final release evidence policy remains authoritative.
Open gaps: all 13 gates remain NOT_RUN; obtain build/typecheck/migration/E2E/security/legal/tax/finance/provider/restore/performance/device/pilot/support/rollback evidence and named approvals. No production deployment or pilot sign-off has occurred.

## Cross-cutting release safety
Live payment capture, outbound provider dispatch and offline alcohol financial posting remain disabled. Production decision is NO_GO. No zero-gap or production-ready claim is made until independent runtime evidence and statutory/business approvals exist.
