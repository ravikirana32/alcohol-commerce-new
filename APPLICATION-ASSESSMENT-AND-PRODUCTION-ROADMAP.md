# Alcohol Commerce Platform: Application Assessment and Production Roadmap

**Assessment date:** 14 November 2026  
**Repository version:** `0.585.0-dev`  
**Decision:** **Not production-ready (NO-GO).** The application is a broad development-stage foundation with meaningful source-level workflows, but the reviewed evidence does not establish a complete, tested, legally approved, supportable bar/POS product.

> Scope interpretation: “standard bar C POS” is treated here as a standard on-premise bar/pub point-of-sale system, with the additional liquor, excise, and licensing controls required by this product. “Implemented” below means present in source unless explicitly called runtime- or end-to-end-verified. A phase document, migration, manifest, or static verifier is not proof that a feature works for operators.

## 1. Executive summary

The product is intended to support licensed-liquor retail, bars/pubs, or hybrid outlets; it also contains brand, distributor, trade, compliance, inventory, and reporting foundations. Its architecture is substantial: a React/Vite web application, an Express/TypeScript API, PostgreSQL migrations, and Docker Compose development services.

Some important business paths are wired through the UI and API. In particular, bar checkout performs server-side validation, tax/excise checks, payment allocation checks, ticket/KOT creation, and stock or open-bottle volume updates in a database transaction. Table sessions and KOT state transitions, retail checkout, shifts, refunds, inventory operations, catalogue/pricing, and role-based authorization also have source implementations.

That is not yet a production claim. Phase 0 has now stabilized the local engineering baseline: syntax checks, API/web typechecks and builds, all 102 API tests, 2 isolated frontend login tests, and 10 existing browser smoke/platform checks pass. Migration preflight reports the four known duplicate-prefix groups as explicitly reviewed and ordered. A production-only dependency audit still finds one high-severity issue in the direct `zod` dependency, whose available fix is a major-version upgrade and needs compatibility work. The current P585 production gate remains **NO-GO**, with mandatory release gates not run. A healthy local Docker stack only shows that this development environment starts; it does not establish a production release.

### Bottom line by use

| Intended use | Assessment |
|---|---|
| Local development/demo | Running in the reviewed Docker environment; health endpoint passed. |
| Supervised prototype/pilot | Possible only after resolving the applicable operational, legal, payment, and workflow gaps and documenting limitations. |
| Live customer bar/pub operations | **Do not deploy yet.** End-to-end business acceptance, legal approval, reliable payment/hardware flows, security review, and production operations gates are not evidenced as complete. |

## 2. How to read this assessment

The repository contains hundreds of phase records and over a thousand Markdown documents across `docs/` and `doc-new/`. Those records are useful for requirements and history, but many describe plans, scaffolds, static checks, or phase-specific delivery—not a complete application acceptance.

This assessment uses the following evidence levels:

1. **Planned/documented** — requirement, design, checklist, or roadmap exists.
2. **Present in source** — route/UI/schema logic exists.
3. **Unit/static checked** — a local test or script checks code or a helper; it may not execute PostgreSQL or a real UI journey.
4. **Runtime verified** — exercised against a running application or database.
5. **End-to-end accepted** — a representative user journey passes browser/API/database assertions, including failure and reconciliation cases.
6. **Production approved** — legal, security, provider, restore, pilot, support, and release gates are signed off for the specific deployment.

Do not treat level 1–3 as level 4–6.

## 3. Product and technical shape

### Product scope found

- Licensed-liquor retail, bar/pub, and hybrid operating profiles.
- Separate retail and bar transactions, packaged stock and open-bottle/peg measures.
- Outlet, organisation, role, and permission concepts.
- Retail and bar checkout, tables and KOT, stock/procurement, shift/settlement, tax/excise, reporting, offline-review, and partner-facing modules.
- Regulatory controls are jurisdiction-sensitive and must be configured and legally reviewed; source presence alone does not establish compliance.

The clearest scope reference is [`docs/PRODUCT-SCOPE.md`](docs/PRODUCT-SCOPE.md). Historical phase records and cumulative registers are in [`doc-new/`](doc-new/); manifests are in [`manifests/`](manifests/), and generated evidence is in [`reports/`](reports/). The actual archive folder is named `doc-new`, not `docs-new`.

### Architecture observed

- **Web:** React/Vite single-page application with role/permission-gated navigation and workspaces.
- **API:** Express/TypeScript routes backed by PostgreSQL; authentication, organisation scoping, and permission checks are applied across business routes.
- **Data:** PostgreSQL schema managed by ordered SQL migrations; Redis is part of the local Compose stack.
- **Local deployment:** Docker Compose starts PostgreSQL, Redis, migrations, API, and web. In the reviewed environment, API readiness returned ready and all five services were healthy.
- **Current Compose safety defaults:** Live payments, notifications, offline financial posting, and consumer discovery are disabled in the local Compose configuration. These defaults are appropriate for a development environment, not evidence that a production deployment has been completed.

## 4. Feature assessment

| Area | What exists in source | Assessment and material gaps |
|---|---|---|
| Authentication and roles | Login/session flow; seeded local role accounts; permission-aware navigation and server-side authorization. | Useful foundation. Needs full authentication/security validation, role/tenant negative tests, account lifecycle, and production identity/secret operations. Demo users/passwords are local-only and must not be used in production. |
| Catalogue and pricing | Product/category/brand and outlet-price APIs and UI. | Foundational catalogue/pricing path. Full menu configuration, modifiers, combos, availability controls, and operator acceptance were not established by the reviewed evidence. |
| Retail POS | Retail checkout route and POS workspace; server-side checkout, stock, and tax logic; helper/integrity tests. | A meaningful retail workflow exists in source. No reviewed browser test proves a complete sale, receipt, stock ledger, and closeout journey against a real database. |
| Bar checkout | Bar checkout API and POS submission; server-side price/tax/excise checks, tender-total checks, ticket/payment/KOT writes, and stock/open-bottle consumption in a transaction. | Strong source-level transaction path. Existing checkout requires payment and creates a paid ticket; it does not demonstrate a conventional unpaid running tab that is settled later. |
| Tables and KOT | Open/transfer/merge/close table sessions; guarded KOT status transitions. | Useful service foundation. Needs full order-before-payment, tab lifecycle, station routing, kitchen/bar acknowledgement, cancellation/void controls, and physical KDS/printer validation. |
| Tabs and bill settlement | Paid tickets can be associated with tables. | **Important gap:** accumulated unpaid tabs, split/partial settlement, combining/separating checks, and later settlement are not demonstrated. |
| Payments and refunds | Checkout accepts tender method/amount/reference allocations; refund and settlement code exists. | Tender allocations are not proof of gateway authorization/capture/void/refund. Provider certification, idempotent callbacks, disputes, settlement reconciliation, and payment hardware are not established. |
| Shifts and cash | Shift open/current/preview/close and cash movement/reconciliation routes. | Basic shift/cash controls exist in source. Needs role-approved cash operations, full denomination/count variance flow, cash drawer integration, replay/failure testing, and end-to-end closeout acceptance. |
| Inventory and open bottles | Stock balance, receipts, adjustments, batches, transfers, stocktakes, and peg-volume depletion are represented in APIs and logic. | Good primitives, but the UI exposes only part of the capability. Recipe/ingredient deduction, robust FEFO/expiry alerts, physical counts, wastage, bottle breakage, and reconciliation need completion and acceptance. |
| Procurement and receiving | Supplier/PO foundations and a goods-receipt/invoice-match schema/API direction are present. | UI documentation says full PO editor and GRN form remain outstanding. Schema existence does not prove a usable procure-to-receive workflow. |
| Tax and excise | Tax rule/profile/pricing APIs and checkout quoting; licence-condition, excise-rule, and dry-day workflows. | Local compliance foundation only. Karnataka dry-day listing is specifically scoped in the reviewed source; broader jurisdictional rules, legal validation, rule-pack lifecycle, statutory calculation evidence, and production approval are outstanding. |
| Reports and exports | Sales summaries/trends/top products and CSV export. | Operational analytics, not demonstrated statutory tax/accounting reports. Saved-report scheduling reports `schedulerEnabled:false`; caller-provided report evidence is not proof of a trusted reporting pipeline. |
| Offline operation | Browser IndexedDB diagnostic queue and API sync/review endpoints. | **Not an offline POS:** queue is diagnostic-only; financial events enter review and offline alcohol financial posting is disabled. A tested offline sale, safe replay, and controlled reconciliation workflow are not demonstrated. |
| Devices and peripherals | Browser-print handoff/diagnostic surface. | Printer protocols, receipt/KOT routing, cash drawer, payment terminal, barcode scanner, and device pairing/health management are not established as production integrations. |
| Brand/distributor/trade | Route and workspace foundations are mounted. | The platform has a broader ecosystem scope, but a complete role-based commercial workflow and third-party acceptance were not demonstrated by the reviewed evidence. |
| Audit/security/tenant controls | Auth middleware, permissions, organisation scope, security-related tests, and audit-oriented routes. | Valuable controls, but no independent penetration test, full authorization matrix against live DB, threat-model sign-off, privacy review, or deployment security approval is evidenced. |
| Operations and deployment | Local Docker, health checks, migration runner/checksums, and startup runbook. | Local Docker works. Production topology, backup/restore drill, monitoring/alerting, SLOs, HA/failover, incident/on-call process, rollback rehearsal, support readiness, and load/capacity sign-off are not proven. |

### “Working end to end” answer

The most complete source-wired business paths are:

- **Retail checkout:** POS workspace → retail API → server-side checkout validation/tax/stock logic.
- **Paid bar checkout:** POS workspace → bar checkout API → ticket, tender allocation, KOT, and stock/open-bottle transaction.
- **Table/KOT operations:** table-session operations and KOT status transitions.
- **Basic shifts and inventory operations:** API routes and supporting UI workspaces.

However, the repository does **not** currently have evidence to label these production-grade, end-to-end accepted flows. The reviewed Playwright suite is limited to smoke/platform acceptance and login-form behavior; it does not exercise a sale, table/tab settlement, refund, shift close, or inventory journey with database assertions. Some API tests cover helper logic and policy boundaries rather than a real transaction through PostgreSQL.

## 5. What a standard bar/pub POS must provide

This is the minimum practical target for a reliable bar POS; liquor-specific controls add to it.

| Capability | Standard operational expectation | Current position |
|---|---|---|
| Menu and service setup | Categories, products, sizes/measures, modifiers, combos, price levels, time-based menus, out-of-stock/availability, tax/service-charge configuration. | Catalogue/pricing foundation exists; full menu and modifier lifecycle not demonstrated. |
| Fast order entry | Search/barcode/quick keys, quantity edits, notes/modifiers, repeat rounds, role-specific screens, reliable keyboard/touch operation. | POS workspaces exist; complete bar-specific speed-of-service usability acceptance is absent. |
| Tables, tabs, and walk-ins | Open tab before payment; transfer/merge tables; add rounds; identify/hold/reopen checks; close later. | Table session primitives exist; paid-ticket flow does not establish full unpaid tab lifecycle. |
| Bar/kitchen production | Route KOT to stations/printers/KDS; acknowledge/prepare/serve; edit/cancel with audit; reprint safely. | KOT state logic exists; physical routing and operator workflow are not production-verified. |
| Bill control | Split by item/person/equal shares; partial/mixed tender; merge/separate; discount/comp/void with approvals and audit trail. | Not established for unpaid tabs; bar checkout currently requires payment allocation. |
| Payments | Cash/card/UPI or configured tender; terminal capture/refund/void; tips; receipts; duplicate-safe callbacks and settlement. | Manual tender allocations exist; live provider integration/certification is not demonstrated. |
| Cash and shift control | Open float, cash in/out, safe drops, blind close/count, variance reasons/approval, cashier/shift handoff. | Basic shift/cash routes exist; full cash-control and hardware acceptance remain. |
| Inventory and costing | Recipes/BOM and ingredient depletion; open-bottle volume; waste/spillage/comps; receiving; transfers; stock counts; cost/margin. | Stock and peg depletion foundations exist; recipe costing and complete procurement/receiving/stock-control UX are not demonstrated. |
| Liquor-specific rules | Licence/outlet eligibility, permitted product and measure, sale restrictions, age/ID process where required, dry-day/time rules, excise/tax records. | Rules and licence foundations exist; legal/jurisdiction approval and production runtime verification remain open. |
| Returns and incidents | Refund/void/reopen controls, reason codes, approvals, audit, payment reversal, stock disposition. | Some refund paths exist; full provider-linked and cashier-accepted flow is not demonstrated. |
| Reporting | Sales by outlet/product/tender/hour/cashier; tax and excise totals; voids/discounts; stock/cost/margin; shift and settlement reconciliation. | Basic sales analytics/export exists; statutory/accounting and complete operational reporting are not demonstrated. |
| Reliability | Offline-safe behavior or explicit fail-closed mode; idempotency; recovery after power/network failure; backups and restore. | Idempotency foundations exist; offline sale posting is intentionally disabled and recovery/restore acceptance is open. |
| Security and audit | Least privilege, outlet scoping, approval separation, session control, immutable event history, secure secrets, tested backups. | Foundations exist; independent security and production control evidence is absent. |
| Devices and usability | Receipt/KOT printers, drawer, scanner, payment terminal, device status, accessible fast service UI. | Browser-print/diagnostic foundation only; device certification/pairing is not established. |

## 6. Verified checks and current blockers

### Runtime snapshot

At the time of this assessment, local Docker services (`postgres`, `redis`, `api`, and `web`) were healthy and `/api/health/ready` reported HTTP and database checks as ready. This is a local-development health check, not a production deployment test.

### Phase 0 baseline status

Phase 0 is **complete locally**. It fixes compile/test blockers, makes dependency installation reproducible, adds isolated frontend login coverage, and puts the frontend browser tests into CI. The hosted GitHub Actions run itself has not been observed in this session and should still be confirmed.

### Validation run for this assessment

| Check | Result | Interpretation |
|---|---|---|
| Clean dependency install | `npm ci` completed successfully using the new lockfile. | Reproducible dependency graph is now available to local builds and CI. |
| Syntax and migration preflight | 282 TypeScript files transpiled with 0 diagnostics; 259 migrations discovered. | Four duplicate numeric-prefix groups are explicitly allowlisted and checked for deterministic order. Preflight remains static; PostgreSQL rollback/dependency validation is separate. |
| API tests | 21 files, 102 tests passed. | Includes authorization, checkout rules, migration ordering, offline policy, and helper/invariant tests. These are not a substitute for complete database-backed business E2E. |
| API/web typecheck and builds | Both typechecks and both builds passed. | Web production bundle is generated; current bundle is about 333 kB minified JavaScript before gzip. |
| Isolated frontend browser tests | 2 passed. | Covers invalid login feedback and successful login followed by authenticated workspace rendering with a mocked API. |
| Existing browser smoke/platform suite | 10 passed against the running local Docker API/web services. | Covers application loading, auth-screen validation, metadata, health, error contracts, and security headers—not bar transaction acceptance. |
| Local Docker image builds and readiness | API/web images built with `npm ci`; existing Docker API readiness and all service healthchecks passed. | Development environment only; does not establish production deployment readiness. |
| Production dependency audit | 1 high-severity direct dependency finding: `zod`; automated remediation requires a major version upgrade. | Compatibility review and a tested upgrade are still required before production approval. |
| P585 release gates | NO-GO; mandatory gates are reported as not run in the current release evidence. | Build/typecheck, DB/API/browser E2E, security/legal approval, provider certification, restore drill, pilot, support, and rollback evidence must be completed. |

Passing local checks and health endpoints must not be used to waive the unresolved production gates or business workflow gaps.

## 7. Priority gaps and risks

1. **Release engineering is not green:** API/web typecheck and build failures block a dependable release artifact; API test failures and stale test assumptions leave regression coverage unreliable.
2. **Core pub workflow is incomplete:** unpaid tabs, accumulated orders, split/partial bill settlement, and later settlement are the central missing bar-service behaviors.
3. **Payments are not operationally complete:** tender recording is not provider capture; refunds, reconciliation, terminal certification, and settlement evidence must be real and tested.
4. **Bar production hardware is not integrated:** KOT lifecycle code is not enough without station routing, printers/KDS, receipt printing, cash drawer, and terminal operation.
5. **Inventory accuracy/cost is incomplete:** recipes/ingredient consumption, wastage, batch/expiry controls, purchase receiving, and inventory-cost reconciliation need usable end-to-end workflows.
6. **Regulatory coverage is not approved:** liquor rules vary by jurisdiction and licence. Current rule packs/statuses and local scope require competent legal/compliance review before any live sale.
7. **Offline behavior is intentionally constrained:** no offline financial alcohol posting is enabled; product behavior during network loss must be explicit, safe, and accepted.
8. **Production operations are unevidenced:** backup/restore, monitoring, alerts, capacity, failover, incident response, data retention, and rollback are mandatory before customer operations.
9. **Documentation/status drift is material:** use P585 evidence for current release status; older phase indexes and manifests can describe narrow source/static delivery or stale phase snapshots. Keep product status synchronized with tested artifacts.

## 8. Phased plan to production readiness

“100% production-ready” is not a permanent property of software; it should mean all defined release gates pass for a named jurisdiction, customer configuration, and deployment. The sequence below turns the current foundation into a measurable release.

### Phase 0 — Baseline and release engineering

**Goal:** Establish a reproducible, green build and credible test baseline before expanding features.

- Fix API TypeScript errors and web `ImportMeta.env` typings.
- Fix the API test failures and suite fixture path; replace brittle source-text checks where practical with behavior tests.
- Resolve duplicate migration prefixes and update migration-order tests to reflect the actual canonical filenames and ordering.
- Add CI checks for typecheck, unit tests, build, migration preflight, and release-gate validation; make failures block merges.
- Verify clean installation from lockfile and document supported Node/Docker versions.

**Exit criteria:** Clean CI on a fresh checkout; API/web typecheck and build pass; all tests pass; migration preflight has no unexplained ordering warnings; one-command local startup and readiness succeed.

### Phase 1 — Bar service and tab lifecycle

**Goal:** Complete the core operator flow from opening a tab to closing a settled check.

- Implement unpaid tabs with durable order rounds before payment.
- Add add/remove/edit item controls and tab reopen/hold behavior with permissions and audit.
- Implement table transfer/merge and split/partial/equal bill workflows; support multiple tenders.
- Complete discount, comp, void, cancellation, refund, tip/service-charge, and manager-approval rules.
- Ensure KOTs route and transition correctly per station; prevent duplicate/reordered tickets.
- Add representative browser journeys that assert UI, API, PostgreSQL rows, inventory, and audit events.

**Exit criteria:** Browser/database tests pass for walk-in sale, table tab with multiple rounds, transfer/merge, split and partial tender, cash/card mix, void/refund approval, KOT reprint/cancel, and recovery from duplicate requests.

### Phase 2 — Menu, recipes, and inventory integrity

**Goal:** Make every sale explainable against menu configuration and stock/cost movements.

- Complete bar menu/measure/modifier/availability/pricing administration.
- Implement recipe/BOM ingredient depletion and margin/cost tracking where applicable.
- Complete open-bottle measurement, spillage/wastage, breakage, comp, and stocktake workflows.
- Complete supplier, purchase order, goods receipt, invoice match, transfer, batch/expiry, and FEFO workflows.
- Make stock movement ledger, inventory balance, and audit state reconcile transactionally.

**Exit criteria:** Automated end-to-end cases reconcile starting stock + receipts − sales − waste + transfers to closing stock, including repeated measures, fractional/invalid quantities, refunds, and concurrency.

### Phase 3 — Payments, cash, tax, and accounting

**Goal:** Connect POS business records to real money and finance controls.

- Integrate selected payment providers/terminals in a certified sandbox and production configuration.
- Implement idempotent authorization/capture/void/refund/webhook handling and provider outage recovery.
- Complete cash drawer and tender closeout, tips, variance approval, settlement reconciliation, and refund-to-provider behavior.
- Validate tax/excise calculations against approved fixtures and define auditable rule activation/versioning.
- Deliver accounting exports/reconciliation and reports that reconcile to source transactions; distinguish operational estimates from posted totals.

**Exit criteria:** Provider certification passes; no duplicate capture/refund under retry; daily tender, cash, settlement, tax, and ledger totals reconcile exactly on controlled test data; finance and compliance owners sign off.

### Phase 4 — Regulatory and jurisdiction approval

**Goal:** Make permitted operations explicit for the deployment jurisdiction and outlet licences.

- Select launch jurisdictions and obtain qualified legal/compliance interpretation.
- Validate licence evidence, permitted outlet profile, product/measure restrictions, dry days/hours, taxes/excise, required records, and age/customer checks where applicable.
- Promote rule packs through draft → reviewed → approved → active with version/effective dates and audit.
- Test boundary conditions, time zones, holidays, rule conflicts, expired licences, and fail-closed behavior.

**Exit criteria:** Written jurisdiction-specific approval and evidence-backed acceptance suite; no live sale can bypass missing/expired licence or required regulatory restrictions.

### Phase 5 — Devices and offline/continuity behavior

**Goal:** Make a busy bar usable and safe under real hardware and network conditions.

- Certify receipt/KOT printers or KDS, barcode scanner, cash drawer, payment terminals, and device pairing/health lifecycle.
- Design an explicit network-loss mode. If offline alcohol sales remain disabled, provide clear fail-closed messaging and recovery. If enabled later, implement encrypted durable queue, replay/idempotency, conflict review, audit, and approved posting.
- Test device disconnects, paper-out, duplicate print, power loss, stale sessions, clock skew, and network retry.

**Exit criteria:** Device compatibility matrix and pilot sign-off; controlled fault-injection tests pass; no duplicate charge, stock posting, or financial event after reconnect.

### Phase 6 — Security, privacy, and data governance

**Goal:** Prove that the platform protects users, tenants, financial data, and regulated operations.

- Complete threat model and independent penetration test; fix and retest findings.
- Test tenant/outlet isolation, permission matrix, privilege escalation, session/token lifecycle, rate limiting, CSRF/CORS, input validation, and audit integrity.
- Define encryption, key/secret rotation, PII/payment retention, deletion/export, privacy notice, and incident/breach processes.
- Enforce least privilege for operators and administrators; review dependency/SBOM and container image vulnerabilities.

**Exit criteria:** Security review approved; no unresolved critical/high findings; authorization matrix tests pass for positive and negative cases; key rotation and incident response are rehearsed.

### Phase 7 — Production operations and resilience

**Goal:** Operate, monitor, recover, and roll back safely.

- Design production topology, TLS/domain, network policy, secret manager, database/Redis sizing, backups, restore, HA, and migration/rollback strategy.
- Add structured logs, metrics, tracing, dashboards, alerts, audit retention, SLOs, and runbooks.
- Load/stress/soak test peak concurrent tills, checkout latency, database contention, and reports.
- Test backups and point-in-time restore; test failover and release rollback using realistic data volumes.
- Establish on-call, support escalation, maintenance, data recovery, and customer communication process.

**Exit criteria:** Signed restore and rollback drills; capacity/SLO targets met; alert coverage and incident owners documented; no unresolved operational single point of failure without an accepted mitigation.

### Phase 8 — UAT, pilot, and controlled general availability

**Goal:** Validate the complete product in real service conditions before broad launch.

- Run scripted UAT with bartenders, managers, finance, inventory, and compliance.
- Train users; validate opening/closing, stock count, tab handling, settlement, refunds, printer failure, and support escalation.
- Pilot at a limited number of licensed outlets with production-like configuration and daily reconciliation.
- Review defects, safety/compliance incidents, support load, performance, and data integrity; close all launch blockers.
- Obtain product, engineering, security, operations, finance, and legal release approvals.

**Exit criteria:** Pilot success criteria met for an agreed observation window; no unresolved Severity 1/2 issue; financial/inventory/regulatory reconciliation signed off; all mandatory release gates pass and are tied to the exact release artifact.

## 9. Production release definition

A release can be called production-ready only when all of the following are true for the target deployment:

- [ ] Reproducible clean install, API/web builds, typechecks, unit tests, migrations, and browser/API/database E2E all pass in CI.
- [ ] Required bar workflows—including unpaid tabs, split/partial settlement, KOT, shifts, refunds, and inventory—pass UAT.
- [ ] Payment providers and physical devices are selected, certified, and reconciled.
- [ ] Jurisdictional legal/compliance requirements and outlet licences are reviewed and approved.
- [ ] Security/privacy assessment is complete; critical/high issues are closed; tenant isolation is proven.
- [ ] Backup restore, failover, migration rollback, load, and outage recovery drills pass.
- [ ] Monitoring, alerts, SLOs, on-call/support, incident response, and operator training are ready.
- [ ] Pilot is accepted and all release gates are recorded against the exact release version.

## 10. Evidence references

- Product scope: [`docs/PRODUCT-SCOPE.md`](docs/PRODUCT-SCOPE.md)
- Current release gate/status: [`manifests/P585-CUMULATIVE-MANIFEST.json`](manifests/P585-CUMULATIVE-MANIFEST.json), [`reports/P585-PRODUCTION-RELEASE-GATES.json`](reports/P585-PRODUCTION-RELEASE-GATES.json), and [`doc-new/P585-STATUS.md`](doc-new/P585-STATUS.md)
- Cumulative open-gap context: [`doc-new/P513-P585-Cumulative-Gap-Register.md`](doc-new/P513-P585-Cumulative-Gap-Register.md)
- Bar checkout: [`apps/api/src/routes/barCheckout.ts`](apps/api/src/routes/barCheckout.ts)
- Retail checkout, stock, shifts, and catalogue routes: [`apps/api/src/routes/operations.ts`](apps/api/src/routes/operations.ts)
- Authentication and authorization: [`apps/api/src/routes/auth.ts`](apps/api/src/routes/auth.ts), [`apps/api/src/middleware/authenticate.ts`](apps/api/src/middleware/authenticate.ts)
- Browser POS and bar workspaces: [`apps/web/src/components/POSWorkspace.tsx`](apps/web/src/components/POSWorkspace.tsx), [`apps/web/src/components/BarServiceWorkspace.tsx`](apps/web/src/components/BarServiceWorkspace.tsx)
- Offline constraints: [`apps/api/src/routes/offlineSync.ts`](apps/api/src/routes/offlineSync.ts), [`apps/web/src/components/OfflineDeviceWorkspace.tsx`](apps/web/src/components/OfflineDeviceWorkspace.tsx)
- Local runtime instructions: [`RUNBOOK.md`](RUNBOOK.md)

---

This assessment is an engineering review, not legal, tax, payment-provider, security-certification, or operational approval. Revalidate it whenever source, deployment configuration, jurisdiction, provider, or release evidence changes.
