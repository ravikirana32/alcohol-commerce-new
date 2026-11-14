# Cumulative Gap Register — P513 onward

**Baseline reviewed:** P522 cumulative source  
**Updated with:** P523 brand/distributor/trade portal foundation  
**Disposition:** Living remediation backlog. Every item below is a candidate gap to close, not a claim that it is already fixed.  
**Release rule:** A static verifier passing does not close a gap that requires a live database, API, browser, security, operational or legal test.

## How to use this register

- Keep the phase origin on each item so a later phase does not obscure where the gap entered the product.
- Close an item only with code reference, automated test evidence, environment details and business-owner acceptance.
- Prioritise security, financial integrity, licensing and stock integrity before usability enhancements.
- Re-run the cumulative regression suite after each remediation.
- Preserve AI, consumer alcohol discovery/transactions and live payment capture as disabled until explicitly authorised and legally reviewed.

## Priority definitions

- **P0 — release blocker:** data loss, cross-tenant access, financial imbalance, licence/compliance failure, unsafe stock or security exposure.
- **P1 — core workflow:** required to operate a reliable outlet workflow end-to-end.
- **P2 — operational maturity:** reporting, automation, usability, scale and integrations.
- **P3 — enhancement:** optional convenience or advanced capability.

## Phase-by-phase gaps

### P513 — Technical integration and build stabilisation
**Current:** Partial; source/static checks pass; dependency-backed build and runtime proof remain outstanding.

| Priority | Gap to consider/fix | Closure evidence |
|---|---|---|
| P0 | Produce a reproducible lockfile and clean dependency install; pin Node/npm and workspace dependency versions | Clean CI `npm ci`, deterministic lockfile diff and SBOM |
| P0 | API and web typecheck + production build are not proven | CI logs for both workspaces with zero errors |
| P0 | Run migrations against disposable PostgreSQL, including rollback/upgrade path | Migration CI from empty DB and prior supported baseline |
| P1 | Full Vitest/API contract tests and Playwright browser E2E not executed | CI test reports and coverage thresholds |
| P1 | P506 live smoke previously returned 404 for liveness/readiness/tenant boundary | Correct health/readiness route tests and tenant isolation smoke |
| P1 | Docker Compose configuration only statically checked; no verified Docker runtime | Compose up, health checks, restart and graceful shutdown test |
| P2 | Complete CI pipeline, artifact provenance, dependency and container vulnerability scanning | Signed build artifacts, scan reports and release workflow |

### P514 — Organisation, outlet and access management
**Current:** Partial; major APIs and organisation/team UI exist; live database and browser validation outstanding.

| Priority | Gap to consider/fix | Closure evidence |
|---|---|---|
| P0 | Prove tenant isolation across every organisation/outlet route, including IDOR and guessed UUID tests | Automated cross-tenant negative tests for all resource APIs |
| P0 | Secure licence document upload/storage; current evidence URI approach is not a complete document workflow | Private object storage, malware scan, access controls, retention and audit tests |
| P1 | Email delivery for invitations is not implemented; token delivery currently requires an authorised operator workflow | Verified email provider, expiry/resend/revocation tests; no token leakage |
| P1 | Licence review/renewal/expiry and outlet suspension workflow needs full operational lifecycle | Admin review queue, evidence, expiry alerts, suspension and audit E2E |
| P1 | Role/permission matrix needs exhaustive route coverage and least-privilege tests | Permission matrix test for every role and route |
| P1 | Outlet assignment and staff suspension/revocation need concurrent-session invalidation tests | Session/token revocation and active-session tests |
| P2 | Organisation audit event search/export/retention controls | Filtered audit UI, export and retention policy |

### P515 — Product catalogue and pricing
**Current:** Partial; catalogue/category/brand/variant and JSON import/export implemented; live verification outstanding.

| Priority | Gap to consider/fix | Closure evidence |
|---|---|---|
| P1 | JSON-only import/export; CSV/XLSX workflows are not implemented | Validated spreadsheet templates, row-level errors and round-trip tests |
| P1 | Image URI field is not secure image lifecycle management | Private upload, MIME/content validation, malware scan, resize/CDN and deletion cleanup |
| P1 | Price effective-date overlap, timezone and concurrent update cases need DB tests | Constraint/transaction tests and price-history acceptance |
| P1 | Tax/HSN/ABV/product classification require India/Karnataka domain review and configurable tax rules | Reviewed tax mapping and invoice test scenarios |
| P1 | Catalogue-to-outlet assortment, availability and outlet-specific price edge cases need end-to-end proof | Multi-outlet catalogue/pricing E2E |
| P2 | Bulk price updates, advanced filters, import preview and rollback UX | Admin workflow acceptance and audit evidence |
| P2 | Product lifecycle, duplicate barcode and variant parent-child edge cases | Automated validation and regression suite |

### P516 — Retail POS
**Current:** Partial; barcode/SKU/name search, cart quantity controls and server-authoritative receipt totals are present.

| Priority | Gap to consider/fix | Closure evidence |
|---|---|---|
| P0 | Checkout concurrency, stock oversell prevention and idempotent retry need live multi-session tests | PostgreSQL concurrency tests and duplicate-submit tests |
| P0 | Server-authoritative tax/discount/rounding calculations need India invoice acceptance | Golden receipt fixtures reviewed by finance/tax owner |
| P1 | Full payment lifecycle for cash/UPI/card/split tender and failed/pending recovery | Payment state machine tests and provider sandbox |
| P1 | Receipt print/PDF, GST invoice/credit note and reprint audit workflow | Printer/PDF and invoice acceptance tests |
| P1 | Returns/exchanges, partial refunds and cancellation must be tested against inventory and finance ledger | End-to-end sale/return/refund reconciliation |
| P1 | Barcode scanner hardware, keyboard wedge, duplicate scans and offline queue behaviour | Device matrix and physical scanner test |
| P1 | Customer, loyalty, discounts, promotions and manager override policies need complete workflow acceptance | Role-based POS E2E |
| P2 | Cashier productivity, keyboard navigation, accessibility and large catalogue performance | Usability and performance test results |

### P517 — Bar tables and KOT
**Current:** Partial; table sessions, transfer/merge/close and KOT queue APIs/UI exist.

| Priority | Gap to consider/fix | Closure evidence |
|---|---|---|
| P0 | Current bar checkout marks tickets PAID immediately; unpaid running tabs/deferred settlement are not implemented | Tab lifecycle with open balance and settlement tests |
| P1 | Bill split/merge and partial settlement orchestration outstanding | Multi-payment, split-by-item/cover and merge tests |
| P1 | Order editing after sending to kitchen, void/comp and manager approval | KOT amendment audit and permission E2E |
| P1 | KOT is browser queue only; no physical KDS/printer integration | Printer/KDS integration, retry and offline tests |
| P1 | Modifiers, preparation instructions, course firing and item routing missing | Menu modifier and kitchen routing acceptance |
| P1 | Table capacity, reservation, waiter assignment and concurrent table operations | Concurrency and floor-operations E2E |
| P2 | Kitchen timing, SLA, recall, bump/reopen and expo station workflows | Kitchen operator acceptance |
| P2 | Service charge, tips, cover charge and outlet-specific tax/rounding policies | Reviewed bill fixtures and finance reconciliation |

### P518 — Inventory and warehouse
**Current:** Partial; transfer/stocktake APIs, batch foundation and basic transfer UI exist.

| Priority | Gap to consider/fix | Closure evidence |
|---|---|---|
| P0 | Stocktake line editing and approval UI are incomplete/API-only | Complete counted-stock workflow with approval E2E |
| P0 | FEFO/FIFO batch deduction is not wired into checkout | Batch-level allocation and expiry-blocking tests |
| P0 | Verify stock ledger invariants across transfer, GRN, sale, refund, wastage and adjustment | Reconciliation invariant tests and negative-stock prevention |
| P1 | Reorder alerts and procurement suggestions outstanding | Threshold/lead-time alerts and PO conversion |
| P1 | Warehouse/location hierarchy, bin/rack and inter-warehouse controls need maturity | Multi-warehouse stock movement tests |
| P1 | Wastage/breakage adjustment workflows need end-to-end approvals | Reason codes, evidence, role controls and audit |
| P1 | Reservation/committed/available stock semantics need implementation | Reservation expiry and oversell tests |
| P1 | Valuation methods (weighted average/FIFO), landed cost and cost-of-goods-sold | Finance-reviewed valuation fixtures |
| P2 | Cycle counts, barcode scanning, mobile stocktake and offline reconciliation | Device and offline E2E |
| P2 | Expiry notifications, recall/quarantine and batch traceability reports | Recall simulation from supplier batch to sales |

### P519 — Procurement and supplier management
**Current:** Partial; supplier/PO/approval/GRN APIs and basic supplier/PO UI exist.

| Priority | Gap to consider/fix | Closure evidence |
|---|---|---|
| P0 | Full GRN UI is missing; receiving is API-led | Receiving UI for full/partial/rejected delivery |
| P0 | Supplier invoice matching and payment workflow incomplete | PO-GRN-invoice three-way match with discrepancy controls |
| P1 | PO editor, amendments, cancellation and revision history | Versioned PO workflow and approval re-trigger |
| P1 | Supplier documents, GSTIN verification, bank detail validation and change controls | Verified supplier onboarding and sensitive-change audit |
| P1 | Returns to supplier, debit notes, credit notes and claims | Procurement return E2E |
| P1 | Landed cost, freight, tax and purchase price variance | Cost allocation and inventory valuation reconciliation |
| P1 | Supplier payment terms, due dates, ageing and payment run | Accounts payable ageing and payment reconciliation |
| P2 | Supplier performance, lead time, fill rate, quality rejection and price history | KPI reports backed by receiving history |
| P2 | E-invoice/e-way bill integration where legally applicable | Provider sandbox and accountant sign-off |

### P520 — Payments, refunds and reconciliation
**Current:** Partial; JSON statement import, duplicate detection and exact matching APIs exist.

| Priority | Gap to consider/fix | Closure evidence |
|---|---|---|
| P0 | Live payment capture/refund is not enabled; gateway lifecycle is not complete | Provider sandbox certification, idempotency, webhook signature/replay tests |
| P0 | Manual exception resolution and batch close are missing | Maker-checker resolution, reason codes and audit trail |
| P1 | CSV/XLSX/provider-specific statement import UI missing | Validated import templates and error preview |
| P1 | MDR/fees, chargebacks, reversals, refunds and payout-to-bank matching outstanding | Net settlement and bank reconciliation tests |
| P1 | Payment state handling for pending/failed/late webhook/duplicate callback | State-machine and webhook reliability tests |
| P1 | Cash drawer and cashier shift reconciliation needs full cash count/variance flow | Shift close and variance approval E2E |
| P1 | Partial refund and tender allocation across split payments needs proof | Refund allocation and ledger tests |
| P2 | Multi-provider adapters, settlement calendar and reconciliation automation | Provider contract tests and scheduled jobs |
| P2 | Finance export and audit-ready reconciliation evidence | Accountant-approved export |

### P521 — Finance and accounting
**Current:** Partial; chart of accounts, journal posting and trial-balance API foundation added in this phase.

| Priority | Gap to consider/fix | Closure evidence |
|---|---|---|
| P0 | P521 journal/accounting migration has not been executed against PostgreSQL; deferred balance trigger needs live validation | Migration and transaction tests, including failed unbalanced posting |
| P0 | Automatic postings from retail sales, bar sales, refunds, GRNs, supplier invoices and payment reconciliation are not wired | Source-to-ledger integration tests with balanced journals |
| P0 | No accountant-approved chart-of-accounts template or outlet/company mapping | Karnataka/India accounting review and signed mapping |
| P1 | Finance UI for accounts, journals, trial balance and drill-down is not yet built | Role-based finance workspace E2E |
| P1 | GST input/output, CGST/SGST/IGST, cess, HSN/SAC and tax-period reports are not implemented | Tax engine mapping and CA-reviewed reports |
| P1 | Profit & loss, balance sheet, cash flow and general-ledger reports missing | Reconciled reports against journal fixtures |
| P1 | Period close, lock dates, journal reversal and approval workflow missing | Period close/reopen controls and audit |
| P1 | Cost centre, outlet-wise P&L, inventory valuation and COGS posting missing | Outlet and product margin reconciliation |
| P1 | Journal number generation and concurrent posting uniqueness require stronger sequence-based implementation | Concurrent posting test and deterministic sequence |
| P2 | Bank feed/import, fixed assets, depreciation, accruals and prepayments | Accounting scope decision and tested workflows |
| P2 | Tally/Zoho/other accounting export integrations | Mapping validation and reconciliation |


### P522 — Reports and Analytics
**Current:** Partial; organisation-scoped reporting APIs exist for operational overview, sales trend, top products, inventory movements and posted-journal P&L. No dashboard UI or runtime proof.

| Priority | Gap to consider/fix | Closure evidence |
|---|---|---|
| P0 | Prove report tenant/outlet isolation, date boundaries and role access against PostgreSQL | Cross-tenant negative tests, outlet-scope tests and permission matrix |
| P1 | Build dashboard UI with date/outlet filters, charts, empty/loading/error states and drill-down | Playwright acceptance across retail/bar/multi-outlet roles |
| P1 | Add CSV/XLSX/PDF exports with permission checks and audit trail | Export fixtures match API totals; file security tests |
| P1 | Complete source-system accounting auto-postings before treating P&L as complete | Sales/refund/GRN/payment posting integration and ledger reconciliation |
| P1 | Add COGS, gross margin, inventory valuation and expiry/FEFO reports | Valuation method approval, stock-ledger reconciliation and batch trace tests |
| P2 | Saved report definitions, scheduled email delivery and report subscriptions | Scheduler retry, recipient permissions, delivery audit and unsubscribe tests |
| P2 | Fill missing dates in trend series and define business timezone/day-close semantics | Timezone boundary fixtures and chart acceptance |
| P2 | Query/index tuning for large date ranges and high-volume outlets | EXPLAIN ANALYZE evidence, load tests and agreed latency SLO |
| P2 | Add supplier, tax, cashier shift, wastage, returns, discounts and payment exception dashboards | Source-to-report reconciliation fixtures and business-owner sign-off |
| P2 | Add report metadata, definitions, freshness timestamp and data dictionary | Documented metric catalogue with finance/operations approval |

## Cross-phase release blockers (P512 governance and all phases)

| Priority | Gap | Required evidence |
|---|---|---|
| P0 | No complete production release approval | P512 gate updated only after every mandatory sign-off |
| P0 | Legal/excise review of Karnataka alcohol business model, licence classes, permitted sales/service, hours, product movement, invoicing and records | Written advice from qualified local counsel/CA and excise authority as appropriate |
| P0 | Outlet licence expiry and operating permission controls | Verified licences, alerting and fail-closed operational tests |
| P0 | Security assessment, penetration test, secrets management, backup encryption and restore proof | Independent security report and restore drill |
| P0 | Data protection, retention, consent, incident response and breach procedures | Approved policies and operational exercises |
| P1 | Monitoring, alerting, tracing, central logs, SLOs and on-call procedures | Production-like load/incident drills |
| P1 | Disaster recovery, RPO/RTO, point-in-time recovery and regional backup strategy | Successful timed restore exercise |
| P1 | Performance/load testing at expected outlets, terminals and peak transaction rates | Signed load test with bottleneck remediation |
| P1 | Accessibility, localization (Kannada/English), currency/timezone and printer compatibility | User acceptance across target device matrix |
| P1 | End-to-end data migration, import reconciliation and rollback plan | Rehearsed migration on representative data |
| P2 | Staff training, SOPs, support escalation and customer onboarding | Pilot training sign-off and support runbook |

## P521 implementation delta

- Added organisation-scoped chart of accounts with account type constraints.
- Added journal headers and debit/credit lines.
- Added transactional journal posting API with organisation/account/outlet validation.
- Added deferred database constraint trigger intended to reject unbalanced posted journals.
- Added trial-balance API for posted journals within a date range.
- Added finance permissions for owner/manager roles.
- **Not included:** automatic operational postings, GST reports, finance UI, P&L/balance sheet/cash flow, period close, reversal approvals or accountant sign-off.

## Recommended remediation order

1. **Foundation gate:** P513 reproducible install/build, migrations, CI, PostgreSQL/API/browser tests.
2. **Security and legal gate:** P514 tenant/permission/licence controls plus P512 governance and legal review.
3. **Inventory integrity:** P518 ledger/batch FEFO and P519 receiving/invoice matching.
4. **Transaction integrity:** P516 checkout, P517 bar tabs/KOT and P520 payment/refund/reconciliation E2E.
5. **Accounting integrity:** P521 automated postings, GST, valuation and financial statements.
6. **Operational readiness:** device/offline, performance, monitoring, backup/restore, training and pilot.

## Closure tracking template

For every gap, record: `Gap ID`, `Origin phase`, `Priority`, `Owner`, `Target phase`, `Implementation PR/commit`, `Automated test`, `Runtime evidence`, `Business approver`, `Status`, `Closed date`.

Suggested statuses: `OPEN`, `IN_PROGRESS`, `BLOCKED`, `READY_FOR_TEST`, `VERIFIED`, `ACCEPTED`.


### P523 — Brand, Distributor and Trade Portals
**Current:** Partial; partner profile submission/approval, buyer-supplier relationship, trade catalogue and B2B order lifecycle APIs are present. No portal UI or live cross-organisation E2E.

| Priority | Gap to consider/fix | Closure evidence |
|---|---|---|
| P0 | Prove cross-organisation authorisation for buyer/supplier actions, including IDOR, guessed UUID and role bypass | Negative tests for every buyer/supplier/platform endpoint with distinct organisations and roles |
| P0 | Add legal/licence and excise eligibility checks for product availability and trade order fulfilment by state, product and partner | Approved Karnataka/other-state legal rules, licence evidence workflow and compliance sign-off |
| P1 | Build brand/distributor and retailer trade portal UIs with onboarding, approval, relationship, catalogue and order views | Playwright E2E for brand, distributor, retailer, bar operator and platform admin |
| P1 | Add product catalogue images, brand assets, product documents and secure media lifecycle | Private object storage, MIME/content validation, malware scan, access and deletion tests |
| P1 | Add price lists, effective dates, currency/tax terms, negotiated pricing and contract terms | Versioned price rules, concurrency tests and finance acceptance |
| P1 | Add order editing before acceptance, partial fulfilment, backorders, cancellations and returns | Order state-machine integration tests and stock ledger reconciliation |
| P1 | Integrate accepted trade orders with procurement, inventory receiving, invoices and supplier balances | Trade order-to-PO/GRN/AP reconciliation with duplicate/idempotency tests |
| P1 | Add credit limits, payment terms, credit holds and overdue exposure | Finance-approved credit rules, race/concurrency tests and audit events |
| P2 | Add distributor territory, outlet coverage, sales rep assignments and delivery routes | Territory conflict and access tests, delivery workflow acceptance |
| P2 | Add trade promotions, schemes, rebates and claims | Eligibility, stacking, approval, accrual and settlement tests |
| P2 | Add delivery proof, shipment tracking and dispatch documents | Carrier/driver integration sandbox and proof-of-delivery audit |
| P2 | Add partner analytics, exports, notifications and SLA reporting | Reconciled reports, delivery retries and partner acceptance |
| P2 | Add full audit history and partner data export/retention controls | Search/export permissions, retention and privacy review |


### P524 — Mobile, Offline and Hardware Integration
**Current:** Partial. A browser device centre now exposes connectivity, IndexedDB diagnostic queue visibility, keyboard-wedge barcode capture and browser print hand-off. It is not a complete mobile POS or offline financial sync implementation.

| Priority | Gap to consider/fix | Closure evidence |
|---|---|---|
| P0 | Implement server-authoritative, idempotent offline sale replay with signed event provenance, device/outlet scope, deduplication, retries and conflict resolution | PostgreSQL/API tests for duplicate, reordered, replayed, tampered and conflicting events; reconciliation proof |
| P0 | Enforce legal/licence eligibility and deny prohibited offline transactions by state/outlet/product | Approved excise rules, licence validation and negative tests |
| P1 | Build Expo/React Native cashier and manager apps with secure token/device storage | Android/iOS builds, device matrix and authenticated workflow E2E |
| P1 | Add background sync, durable queue lifecycle, backoff, dead-letter handling and operator recovery UI | Network interruption/restart tests and no-loss/no-duplicate evidence |
| P1 | Integrate native barcode camera/Bluetooth/USB scanning and device-specific configuration | Tested scanner matrix including malformed/duplicate scans |
| P1 | Implement ESC/POS and network/Bluetooth receipt and kitchen printing, templates and retry queue | Physical printer compatibility and failure/reprint tests |
| P1 | Add cash-drawer kick with permission, audit and reconciliation | Supported hardware test and manager approval/audit tests |
| P1 | Add device enrollment, attestation/trust, revocation, lost-device response and fleet inventory | Cross-tenant/device security tests and operational runbook |
| P2 | Add mobile stock count, purchase receiving and batch/expiry capture | Offline/online inventory ledger reconciliation and barcode E2E |
| P2 | Add sync health telemetry, support diagnostics, storage quota handling and data-retention controls | Observability dashboards, recovery drills and privacy review |

### P525 — Offline Sync Intake, Idempotency and Reconciliation Ledger
**Current:** Partial. Adds organisation/outlet-scoped device enrolment and revocation, bounded batch intake, SHA-256 payload hashes, idempotent batch replay, per-device event/sequence uniqueness, conflict classification and audit records. Financial and stock-affecting events remain quarantined for review; this phase does not post sales, tenders, stock movements or journals. Runtime database/API/security evidence is outstanding.

| Priority | Gap to consider/fix | Closure evidence |
|---|---|---|
| P0 | Add cryptographic device attestation and signed event provenance; current device ID is an enrolled identifier, not proof of device integrity | Key provisioning/rotation, signed payload verification, tamper/replay tests and lost-device drills |
| P0 | Prove migration and transactional batch intake against PostgreSQL, including concurrent same-batch/event submissions and cross-tenant IDOR | Disposable PostgreSQL integration suite, race tests and negative organisation/outlet tests |
| P0 | Implement an authorised reconciliation workflow with maker-checker controls; no endpoint currently promotes quarantined events to posted business transactions | Dual-control review, immutable decisions, stock/sales/payment/accounting reconciliation and finance sign-off |
| P0 | Validate offline event age, monotonic sequence windows, clock drift and device revocation timing | Stale-event and reordered-event policy tests with deterministic server timestamps |
| P1 | Add retry/backoff, resumable chunking, dead-letter queue and client acknowledgement cursor protocol | Network-drop/restart tests demonstrating no loss and no duplicate effects |
| P1 | Add payload schema versioning, canonical JSON hashing and backward-compatible event upgrades | Versioned contract fixtures, canonicalisation tests and migration compatibility matrix |
| P1 | Add per-event reconciliation status API, review queue UI and operator reason codes | Role-based review UI E2E and audit export |
| P1 | Add rate limits, per-device quotas, retention and encrypted payload-at-rest policy | Abuse/load tests, retention jobs and security review |
| P2 | Add device fleet telemetry, sync latency dashboards and support diagnostics | Operational dashboards, alert thresholds and support runbook |

**P525 scope note:** The ledger is an intake/quarantine foundation, not a production offline checkout feature. The existing offline eligibility helpers are not invoked to authorise transactions by this API. Keep offline financial posting disabled until legal, security, accounting and runtime acceptance gates are complete.

### P526 — Offline Reconciliation and Maker-Checker Review
**Current:** Partial. Added an organisation-scoped event review queue, separate reviewer decision, mandatory reason, self-review denial and audit records. Approved events remain `APPROVED_NO_POST`; conflicts are not approvable. Runtime concurrency, database and browser evidence is outstanding.

| Priority | Gap to consider/fix | Closure evidence |
|---|---|---|
| P0 | Enforce reviewer role separation at outlet/organisation and test privileged-role bypass, concurrent decisions and revoked users | PostgreSQL/API security tests with multiple users, outlets and organisations |
| P0 | Add event-level validation against current product, price, tax, licence, stock and payment evidence | Versioned validation rules and finance/excise-approved fixtures |
| P0 | Add controlled posting integration with transactionally idempotent sales, payment, stock and journal effects | End-to-end reconciliation against each authoritative ledger with rollback/race tests |
| P1 | Add reviewer assignment, SLA, escalation, reason codes and immutable decision history | Workflow E2E and audit export acceptance |
| P1 | Add exception resolution for conflict/duplicate/stale events without mutating original payload | Corrective-event workflow and full provenance tests |

### P527 — Offline Event Validation and Posting Intents
**Current:** Partial. Adds immutable validation evidence, event-type payload checks, organisation-scoped posting-intent records and a UI view of validated intents. Passing financial/stock events transition to `READY_FOR_POST`; diagnostics never create intents. P527 deliberately does not mutate sales, payments, inventory or accounting ledgers.

| Priority | Gap to consider/fix | Closure evidence |
|---|---|---|
| P0 | Replace structural payload checks with authoritative product, outlet, price-book, tax/GST, excise licence, age/transaction eligibility, stock and payment validation | Integration tests against live domain services and signed Karnataka/state compliance rules |
| P0 | Implement a transactionally idempotent posting worker for sale/payment/stock/journal entries, with an outbox/inbox and deterministic rollback | PostgreSQL concurrency/replay/failure-injection tests proving exactly-once business effect |
| P0 | Enforce event freshness, sequence windows, clock drift, device signature/attestation and revocation at validation time | Tamper, stale-event, revoked-device and replay security tests |
| P0 | Add a second maker-checker gate for posting intents and immutable hold/cancel/release workflow | Independent approver tests and audit export |
| P1 | Reconcile payment evidence with gateway/acquirer/cash tender and prevent unsupported payment claims | Tender-level reconciliation fixtures and finance sign-off |
| P1 | Add product master and price version snapshot validation and resolve changed/deleted products | Versioned catalogue fixtures and conflict-resolution acceptance |
| P1 | Add operator UI for validation detail, failure remediation and posting-intent decisions | Playwright role-based E2E and accessibility review |
| P1 | Add metrics, alerting, retention and replay support for validation/posting queues | Operational dashboards, restore/replay drills and data-retention approval |

**P527 scope note:** `READY_FOR_POST` is an intent state, not a posted transaction. No offline financial or stock posting is enabled. The payload checks are structural preconditions only and must not be treated as authoritative legal, tax, pricing, stock or payment validation.

### P528 — Authoritative Offline Business Validation
**Current:** Partial. Adds live organisation/outlet status checks, verified licence/capability checks, active organisation-owned product checks, current outlet-price comparisons, retail stock pre-checks, payment-allocation arithmetic, immutable evidence, holds and audit. It does not post any ledger. Bar checkout fails closed because measure-aware bottle depletion is not implemented. Licence capability mapping requires legal/jurisdictional confirmation.

| Priority | Gap to consider/fix | Closure evidence |
|---|---|---|
| P0 | Confirm licence capability codes and eligibility logic against approved Karnataka and other-state excise rules; add age, sale-time, product/category and quantity restrictions | Signed legal/excise rule catalogue, versioned rule evidence and negative tests for expired/suspended/wrong-activity licences |
| P0 | Implement bar stock validation for bottle, packaged and peg measures with open-bottle depletion, wastage and reservation handling | Measure-aware inventory tests reconciling bottle ml, stock units, open bottles and ledger balances |
| P0 | Add tax/GST/cess calculation and immutable price/tax snapshots; current price check covers only current unit price | Finance/tax-approved fixtures and effective-date, rounding, interstate/intrastate tests |
| P0 | Validate payment evidence against gateway/acquirer settlement, cash tender and supported payment methods; current check only compares payload arithmetic | Payment reconciliation integration tests and finance sign-off |
| P0 | Add independent second maker-checker approval and transactional idempotent posting worker/outbox for sale, payment, stock and journal effects | PostgreSQL concurrency/replay/failure-injection tests proving one business effect, rollback and ledger reconciliation |
| P0 | Add device signature/attestation, revocation, event freshness, sequence window and clock-drift validation at authoritative-check time | Signed event/tamper/replay/stale/revoked-device security tests |
| P1 | Persist and validate catalogue/price/rule versions and revalidation workflow after held outcomes without mutating immutable evidence | Versioned snapshots and corrective-event workflow E2E |
| P1 | Add check detail/hold remediation UI, exception assignment, reviewer SLA and audit export | Role-based Playwright E2E and accessibility acceptance |
| P1 | Execute migration and API tests on PostgreSQL, including cross-organisation IDOR, concurrent check attempts and transaction rollback | CI integration suite with disposable PostgreSQL and security test report |

**P528 scope note:** A `PASS` means the current pre-checks passed; it is not a sale authorisation and does not create a business ledger effect. Bar events intentionally fail closed pending measure-aware stock validation. Do not enable offline financial posting until legal, finance, security and runtime acceptance gates are complete.


## P529 — Offline Posting Approval and Maker-Checker Controls

P529 adds an immutable approval decision for validated offline posting intents. The approver must be distinct from the intent creator, sync submitter, reconciliation reviewer, structural validator and authoritative checker. Approval captures a hash of the validation evidence and an audit event. `AUTHORIZED_TO_POST` remains a permission state only; there is no posting worker or ledger mutation.

| Priority | Gap to consider/fix | Closure evidence |
|---|---|---|
| P0 | Implement a transactional posting worker/outbox with idempotency keys across retail sales, tenders, stock movements and journals | PostgreSQL concurrency/replay/failure-injection tests prove exactly-once business effects and rollback |
| P0 | Recheck live licence, product, price, tax, stock and payment evidence at posting time; invalidate approvals when source versions change | Version-bound approval hashes and revalidation tests |
| P0 | Complete jurisdiction-specific excise, age, sale-time, quantity, tax/GST/cess and payment eligibility rules | Signed legal/finance rule catalogue and negative E2E tests |
| P0 | Test maker-checker permissions under concurrent requests, revoked users, token expiry and cross-organisation IDOR | PostgreSQL/API security suite with parallel approval attempts |
| P1 | Add approval history and exception details to exportable audit reporting | Role-based UI, CSV/PDF audit export and retention tests |
| P1 | Add reversal/compensation workflows for a posted event after settlement or stock reconciliation | Tested compensating transactions; never delete posted audit history |

**P529 scope note:** Approval authorizes a future posting worker only. It does not create a sale, payment, stock movement, tax entry or journal. Do not enable offline financial posting until the P0 exit gates above are complete.

### P530 — Transactional offline retail posting
**Current:** Partial. A transactionally scoped retail posting endpoint and immutable execution record are implemented. Static acceptance passes; live PostgreSQL/API/concurrency evidence is outstanding.

| Priority | Gap to consider/fix | Closure evidence |
|---|---|---|
| P0 | PostgreSQL transaction, unique execution, sale idempotency and stock-row locking need live multi-session race and crash/retry tests | Integration tests prove one sale/stock decrement/payment record under concurrent retries and rollback on injected failure |
| P0 | P530 posts retail sale and stock only; automatic double-entry journal, tax payable and COGS remain outstanding | P536 balanced journal/COGS tests reconcile to sale, payments, inventory valuation and tax |
| P0 | Bar offline posting was blocked at P530; P531 now implements PEG/BOTTLE/PACKAGED posting, exact open-bottle depletion and reservation-aware stock checks. Runtime proof remains outstanding | PostgreSQL concurrency/failure-injection tests reconcile bottle millilitres, stock units, ticket/KOT, peg transactions and stock movements |
| P0 | Offline payment rows are evidence only (`RECORDED_OFFLINE`); settlement is not confirmed | P535 provider/cash reconciliation and settlement lifecycle tests |
| P1 | Current product/price/stock rechecks need race and effective-price boundary coverage | Price change, product suspension, stock depletion and outlet suspension integration tests |
| P1 | Historical verifier scripts P522–P529 contain phase-specific version assertions and therefore fail when run against P530 version | Update verifier policy to assert current synchronized version while preserving historical phase assertions |
| P1 | Operator UI action is now present but browser E2E, role-based access and failure-state handling are not tested | Playwright role-gated posting, confirmation, error handling and audit trail E2E |
| P0 | Clean PostgreSQL migration and upgrade/rollback execution not performed in this environment | CI migration run from empty and supported prior schema baselines |


### P531 — Bar Measure & Open-Bottle Inventory
**Current:** Partial. Extends the P527–P530 workflow to transactionally post offline `BAR_CHECKOUT` events after structural validation, authoritative checks and independent approval. PEG lines deduct exact integer millilitres from outlet/product-scoped open bottles; BOTTLE/PACKAGED lines decrement stock units. Bar tickets, ticket lines, KOT, peg transactions, stock movements, offline tender evidence and posting execution are committed in one transaction. Adds bottle volume reservations, expiry/release, reservation-aware online/offline checkout, and measured wastage/breakage/complimentary/adjustment deductions. Static verification passes; live PostgreSQL/API/concurrency/browser evidence is outstanding.

| Priority | Gap to consider/fix | Closure evidence |
|---|---|---|
| P0 | Run PostgreSQL clean install and upgrade for migration 230; validate the new bar payment status and execution-to-ticket FK/constraint | CI migration from empty and P530 schema baselines, rollback/reapply and schema assertions |
| P0 | Prove exactly-once bar ticket, KOT, peg transaction and stock movement effects under concurrent replay, same-bottle pours and same-SKU packaged lines | Multi-session PostgreSQL tests with duplicate requests, reversed line order, process crash and failure injection |
| P0 | Prove reservation race handling among reservation creation, online checkout, offline posting, release and expiry | Concurrent lock tests proving reserved millilitres are never consumed by unreserved checkout |
| P0 | Run full bar event workflow through sync intake, reconciliation, structural validation, authoritative check, independent approval and posting | API integration and browser E2E with maker-checker users, organisation/outlet IDOR negatives and full ledger reconciliation |
| P0 | Approve jurisdiction-specific licence, age, sale-time, product and quantity eligibility; current licence capability remains a coarse prerequisite | Signed legal/excise rule catalogue and negative tests (P533) |
| P0 | Reconcile `RECORDED_OFFLINE` tender evidence with cash/gateway settlement and create automatic balanced journals/COGS | P535 payment reconciliation and P536 finance journal/COGS acceptance |
| P1 | Add reservation consumption/reallocation semantics for offline events that carry an explicit reservation reference; current posting protects reserved volume by excluding it from unreserved availability | Reservation-bound offline event contract and tests for partial consumption/release |
| P1 | Add native offline cashier event creation, durable mobile queue and device attestation | Expo/mobile builds, signed event tests and network interruption/restart E2E (P538) |
| P1 | Add operational alerts for stale reservations, bottle variance, low remaining volume and failed posting intents | Dashboard/alert thresholds, operator drill and audit export |
| P1 | Typecheck, unit tests, API integration, Playwright and physical hardware validation in a dependency-complete CI environment | Green CI report and supported device/printer matrix |

**P531 scope note:** `POSTED` means the bar ticket, measure depletion, stock movements and offline tender evidence were transactionally recorded. It does not mean payment settled or a journal/COGS was posted. Accounting remains deferred to P536 and payment settlement to P535. Static acceptance is not runtime proof.

## P532 — Offline Exception & Recovery Engine

**Status: PARTIAL / developer preview.** Durable recovery cases, automatic case creation for blocked posting executions, append-only action history, triage, corrected-event retry requests, cancellation of unposted held intents, and maker-checker compensation decisions are implemented.

### Remaining P532 gaps
- [ ] Execute migration 231 against clean PostgreSQL and P530/P531 upgrade baselines; validate rollback/reapply and constraints.
- [ ] Run API integration tests for organisation scoping, permissions, case lifecycle and all negative state transitions.
- [ ] Run concurrent triage/cancel/retry/compensation decision tests and injected-failure rollback tests.
- [ ] Run browser E2E for operator recovery workspace and maker-checker separation.
- [ ] Verify automatic case + action + audit creation on real blocked posting transaction.
- [ ] Implement actual stock/payment/journal compensation only after P535/P536; P532 approval is a handoff marker only.
- [ ] Add native mobile recovery queue and offline recovery command handling in P538.

### P532 verification
- Static acceptance: 16/16 PASS.
- P530 regression: 22/22 PASS.
- P531 regression: 31/31 PASS.
- P528/P529 static regressions: 15/15 and 16/16 PASS with historical version assertions aligned to current release.
- TypeScript syntax transpilation: 244 files, 0 diagnostics.
- SQL migration static ordering: 231 files PASS; inherited duplicate numeric prefixes 150, 151, 176 and 223 remain warnings.
- Workspace typecheck is blocked by missing dependency/type packages. PostgreSQL/API/concurrency/browser runtime tests were not run.

## P533 — Excise & Regulatory Rules Engine

**Status: PARTIAL / developer preview.** Karnataka effective-dated rule-pack engine, legal source register, maker-checker/third-person pack activation, verified licence operating hours, official dry-day orders, immutable compliance decisions and online/offline sale gates are implemented. The seeded Karnataka pack remains DRAFT; no production sale is enabled by this phase.

### Remaining P533 gaps
- [ ] Qualified Karnataka excise counsel / authority must validate the Gazette and rule interpretations, licence class mapping, 21+ age rule, restricted-customer categories, Gandhi Jayanti rule and CL2A/CL9A conditions.
- [ ] Apply migration 232 to clean PostgreSQL and P532 upgrade baseline; test rollback/reapply, FK constraints and immutable triggers.
- [ ] API integration tests for rule pack draft/edit/submit/review/third-person activation, licence-hour verification, dry-day review and tenant permissions.
- [ ] Concurrent rule-pack activation, licence schedule replacement, dry-day approval and checkout-versus-order race tests.
- [ ] Browser E2E for Compliance workspace and cashier attestations.
- [ ] P538 must add cryptographic secure-clock/device-time attestation; offline alcohol posting is intentionally blocked until then. The offline event producer must also collect compliance attestations and offset-aware timestamps.
- [ ] Add a visual rule editor/source evidence viewer in Compliance UI; rule editing API exists but the UI is not yet complete.
- [ ] Add reviewed rule packs for other Indian states; unsupported jurisdictions are blocked.
- [ ] Customer age proof is an operator attestation only; legal review must confirm acceptable process and staff training.
- [ ] Run typecheck, Vitest, PostgreSQL integration, security/IDOR and performance tests in dependency-complete CI.

### P533 verification
- Static acceptance: 24/24 PASS.
- P530 regression: 22/22; P531: 31/31; P528: 16/16; P529: 16/16; P532: 16/16.
- TypeScript syntax transpilation: 248 files, 0 diagnostics.
- SQL migration static ordering: 232 files PASS; inherited duplicate numeric prefixes 150, 151, 176 and 223 remain warnings.
- Vitest unavailable and semantic typecheck blocked by missing dependencies/declarations.
- PostgreSQL/API/concurrency/browser runtime tests and legal sign-off not run.
