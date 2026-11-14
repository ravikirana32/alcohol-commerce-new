# Alcohol Commerce Platform — Cumulative Gap Register

**Coverage:** P513 onward, updated through P534  
**Baseline:** P533 cumulative 0.533.0-dev  
**Current delivery:** P534 0.534.0-dev — PARTIAL / developer preview.

This register supplements the P513–P533 historical backlog. A static verifier passing does not close a gap requiring live database, API, browser, security, operational or legal evidence.

## P534 delivered scope

- Migrations 233–236: effective-dated tax packs/components, product profiles, outlet prices, immutable snapshots/attempts, sale-line/ticket-line snapshot references, BAR measure tiers and effective-period overlap guards.
- Rule-pack draft/submission/independent review/third-distinct-admin activation lifecycle.
- Product profile and outlet price APIs with independent verification/review.
- Server-side tax quote service wired into retail and bar checkout; no legacy `tax_rate` fallback.
- Immutable tax snapshots are linked to retail sale lines and bar ticket lines.
- Inclusive/exclusive percentage, per litre pure alcohol, per bulk litre, fixed per unit and price slab calculation bases.
- MRP/menu ceiling, GST consistency, outlet state/profile jurisdiction matching, PEG volume bounds and overlap safeguards.
- Tax & Pricing administration UI with profile, price and effective-date workflows.

## P534 open gaps

| ID | Priority | Gap | Closure evidence | Status |
|---|---|---|---|---|
| P534-01 | P0 | Execute and browser-test tax-backed retail/bar checkout; verify line snapshot references and golden invoice totals. | PostgreSQL/API/browser E2E with server totals and immutable snapshot links. | CODE WIRED; RUNTIME OPEN |
| P534-02 | P0 | Execute migrations 233–236 on clean PostgreSQL and P533 upgrade baseline; test rollback/reapply, FKs, triggers and concurrency. | PostgreSQL CI logs and restore/rollback rehearsal. | OPEN — ENVIRONMENT BLOCKED |
| P534-03 | P0 | Obtain official Gazette/notification tax rates and qualified Karnataka legal/excise counsel + CA approval. No statutory rates are seeded. | Signed source register, reviewed tax schedule and written acceptance. | BLOCKED_EXTERNAL |
| P534-04 | P0 | Run tenant IDOR, permissions, concurrent pack activation, price approval and checkout-vs-price race tests. | Disposable PostgreSQL API/security/concurrency suite. | OPEN — RUNTIME NOT RUN |
| P534-05 | P1 | Complete role-based browser acceptance of product profile and outlet-price administration UI. | Playwright E2E and operator acceptance. | UI IMPLEMENTED; BROWSER TEST OPEN |
| P534-06 | P1 | Add place-of-supply/interstate state resolution and multi-state tax packs. | Jurisdiction fixtures and legal/tax sign-off. | OPEN — OUT OF SCOPE |
| P534-07 | P1 | Add finance-approved multi-line invoice, rounding, inclusive/exclusive mixing, variant and bar measure golden fixtures. | CA/finance-approved invoice fixtures and API tests. | OPEN |
| P534-08 | P1 | Reconcile tax payable, tenders, settlements and balanced journals with P535/P536. | Source-to-ledger reconciliation and CA approval. | FOLLOW-ON P535/P536 |
| P534-09 | P1 | Run dependency-backed API/web typecheck, Vitest and browser E2E. | Clean CI logs and coverage report. | BLOCKED_ENVIRONMENT |
| P534-10 | P1 | Review/reapprove legacy BAR price rows migrated as BOTTLE and create correct PEG/PACKAGED price books. | Outlet-by-outlet approved price book and measured bar bill acceptance. | IMPLEMENTED; OPERATIONS OPEN |
| P534-11 | P0 | Prevent cross-state product tax profiles from being used at an outlet. | Negative jurisdiction mismatch tests at API and checkout. | CODE GUARD ADDED; RUNTIME OPEN |
| P534-12 | P0 | Prevent overlapping ACTIVE tax packs and APPROVED outlet prices, including concurrent approval races. | PostgreSQL trigger tests with simultaneous activation/approval. | CODE GUARD ADDED; RUNTIME OPEN |

## Cross-phase gates carried forward

- P513 foundation: reproducible clean install/lockfile, CI, PostgreSQL migrations, API and browser E2E.
- P514 security: cross-tenant IDOR and least-privilege permission matrix, licence lifecycle and secure document storage.
- P518/P519 inventory/procurement: FEFO/batch ledger invariants, GRN UI, PO-GRN-invoice matching and landed cost.
- P520/P521 payments/accounting: complete provider lifecycle, cash reconciliation, refunds, automatic operational postings, tax payable, COGS and accountant-approved COA.
- P522 reporting: dashboard UI, exports, tenant isolation, COGS/margin/valuation and data reconciliation.
- P523 trade portals: cross-organisation authorisation, partner portal UI, contract pricing, fulfilment and supplier accounting.
- P524–P533 offline/excise: device attestation, secure-time evidence, authoritative legal rules, posting/stock/payment/journal reconciliation, live runtime and security evidence.
- Production gate: legal/excise, licence, privacy, security, backup/restore, monitoring, performance, accessibility/localisation, training and formal release approval.

## P534 verification evidence

- P534 static acceptance: 36/36 PASS.
- Retail checkout verifier: 17/17 PASS; bar ticket/refund verifier: 9/9 PASS; P533 excise regression: 24/24 PASS.
- TypeScript syntax transpilation: 253 files, 0 syntax diagnostics; this is not a semantic typecheck.
- Migration static validation: 236 ordered SQL files PASS; inherited duplicate numeric prefixes 150, 151, 176 and 223 remain warnings.
- `npm install` did not complete within the environment timeout; no `node_modules` or lockfile was produced. Vitest and semantic typechecks were not run.
- PostgreSQL is not available in the environment; migration execution, rollback, trigger concurrency, API integration, checkout E2E, browser E2E, IDOR and performance tests were not run.
- Official tariff verification and legal/accounting review were not available.

## Release boundary

P534 remains PARTIAL / developer preview. Do not enable production sales or treat tax quotes as production invoice evidence until statutory rates, legal/accounting review and runtime acceptance are complete. Offline alcohol posting remains disabled pending P538 trusted device/time evidence and all prior gates.

## Final P534 disposition (2026-11-10)

The code delivery is complete for developer-preview scope. P534 is **not fully accepted for production** because the remaining items require an actual PostgreSQL/CI environment, finance approval and official statutory/legal evidence. Do not relabel these as completed by static checks. P535/P536 may address settlement and accounting integration but do not close P534's legal, runtime or security gates.

---

# P535 update — Payment Provider, Cash Reconciliation & Settlement Lifecycle

**Current delivery:** P536 0.536.0-dev — backend + finance workspace developer preview; production acceptance not established.

## P535 delivered scope

- Migration 237: provider webhook evidence, tender allocation lifecycle, cash denomination count, settlement batch/item and payment exception ledgers.
- Raw-body HMAC SHA-256 provider webhook intake with constant-time signature comparison and provider-event idempotency; accepted events remain REVIEW_REQUIRED.
- Tender lifecycle states include RECORDED_OFFLINE; non-cash tenders cannot be manually confirmed and require unique exact settlement matching.
- Cash denomination capture by open shift with actor/time and shift event evidence.
- Provider settlement gross/fee/net import with duplicate batch protection and arithmetic constraint.
- Settlement matching by provider + provider transaction ID + exact amount; unmatched/duplicate/mismatch rows create exceptions.
- Bank payout confirmation requires a fully matched batch and net amount agreement.
- Payment exception listing and reasoned resolution endpoint.

## P535 open gaps

| ID | Priority | Gap | Closure evidence | Status |
|---|---|---|---|---|
| P535-01 | P0 | Execute migration 237 on clean PostgreSQL and P534 upgrade; test rollback/reapply and all constraints/indexes. | PostgreSQL CI + rollback rehearsal. | OPEN — RUNTIME NOT RUN |
| P535-02 | P0 | Provider-specific webhook signature canonicalization, timestamp/replay protection, sandbox certification and event-to-payment mapping. | Provider sandbox fixtures, replay/race tests and signed certification. | PARTIAL — GENERIC HMAC INTAKE ONLY |
| P535-03 | P0 | Automatically emit tender allocations from all retail/bar checkout and split-tender flows. | Checkout API integration tests with one-to-many tenders and reconciliation. | OPEN |
| P535-04 | P0 | Tenant IDOR, provider-event idempotency race, settlement matching concurrency and permission matrix. | PostgreSQL-backed adversarial integration tests. | OPEN — NOT RUN |
| P535-05 | P1 | Cash expected-vs-counted calculation, shift close variance, manager approval and immutable final close. | Cash close workflow E2E and audit evidence. | PARTIAL — DENOMINATION CAPTURE ONLY |
| P535-06 | P1 | Refund allocation to original tender(s), split-tender proportional routing and provider refund confirmation. | Refund lifecycle fixtures and provider sandbox proof. | OPEN |
| P535-07 | P1 | Chargebacks, reversals, MDR/fee allocation, partial settlements and dispute lifecycle. | Provider statement fixtures and finance-approved reconciliation. | OPEN |
| P535-08 | P1 | Automated bank statement ingestion and bank evidence attachment/storage. | CSV/XLSX import tests and bank statement matching. | PARTIAL — MANUAL BANK REFERENCE ONLY |
| P535-09 | P1 | Role-based admin UI for provider events, settlement imports, matching, cash counts and exceptions. | Playwright workflow and operator acceptance. | OPEN — UI NOT IMPLEMENTED |
| P535-10 | P1 | Full semantic typecheck, Vitest, API integration and browser E2E. | Clean dependency-backed CI report. | OPEN — ENVIRONMENT BLOCKED |
| P535-11 | P1 | Provider credentials vaulting, rotation, webhook endpoint rate limiting and operational alerting. | Security review, secret rotation and load/abuse tests. | OPEN |
| P535-12 | P1 | P536 automatic journals for gross tender, fees, refunds, settlement clearing, bank payouts and cash variance. | Balanced double-entry journals and finance/CA sign-off. | DEFERRED TO P536 |

## Carried-forward P534 blockers

P534-01 through P534-12 remain open as recorded above. P535 does not supply statutory tax validation, legal sign-off, tax golden invoice acceptance, or PostgreSQL runtime evidence.


## P536 — Automated Accounting, Tax Ledger, COGS & Period Controls

**Status: PARTIAL / developer preview.** Organisation-scoped accounting mappings, idempotent source posting endpoint, balanced journal generation, sales/refund tax legs, settlement clearing and MDR fee legs, COGS/inventory legs, accounting period controls, posted-journal immutability and Finance & Accounting mapping/period UI are implemented.

### Remaining P536 gaps
- [ ] Wire trusted event adapters from retail checkout, bar checkout, retail/bar refunds, GRN/procurement, inventory consumption and P535 settlement matching into source posting.
- [ ] Independently retrieve and validate original sale/refund/tax snapshot/tender/settlement/GRN evidence; do not rely on caller-supplied amounts alone.
- [ ] Implement inventory valuation and cost-layer calculation; current COGS endpoint consumes a supplied cost amount.
- [ ] Add reversal request, independent approval and reversal journal generation; posted journal mutation is blocked.
- [ ] Add general ledger drill-down, P&L, balance sheet, cash flow, GST liability reports and audit export.
- [ ] Validate chart of accounts, mappings, normal balances, rounding and tax treatments with qualified CA/accountant and legal review.
- [ ] Add period overlap/concurrency, close checklist, bank/tax/stock reconciliation and unposted-source queue controls.
- [ ] Run clean PostgreSQL install and P535 upgrade, migration rollback/reapply, API integration, duplicate/concurrency, tenant IDOR, permission and failure-injection tests.
- [ ] Run dependency-backed semantic typecheck, Vitest and browser E2E in CI.
- [ ] Carry forward P534 statutory rate/legal sign-off, P535 provider adapter/refund/chargeback/checkout integration and P538 secure-time/device attestation blockers.

### P536 verification
- P536 static acceptance: 15/15 PASS.
- P535 regression static acceptance: 14/14 PASS.
- TypeScript syntax transpilation: 257 files, 0 diagnostics (not semantic typecheck).
- SQL migration static ordering: 238 files PASS (static only).
- PostgreSQL/API/browser runtime tests and accountant/legal sign-off not run.
