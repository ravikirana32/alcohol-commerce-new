# Alcohol Commerce Platform — Cumulative Gap Register

**Coverage:** P513 onward, updated through P537  
**Baseline:** P536 cumulative 0.536.0-dev  
**Current delivery:** P537 0.537.0-dev — PARTIAL / developer preview.

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

**Current delivery:** P535 0.535.0-dev — backend developer preview; production acceptance not established.

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

## P536 — Automated accounting follow-up gaps

| ID | Priority | Gap | Closure evidence | Status |
|---|---|---|---|---|
| P536-01 | P0 | Connect source posting automatically to every retail/bar checkout, refund, GRN, inventory consumption and P535 settlement. | End-to-end source event tests proving exactly-once balanced postings. | OPEN — trusted adapters not integrated |
| P536-02 | P0 | Independently fetch/reconcile source sale, P534 tax snapshot, P535 tender/settlement and inventory valuation; do not trust caller-supplied totals alone. | API integration and source-to-ledger reconciliation fixtures. | OPEN |
| P536-03 | P0 | Obtain accountant/CA approval for COA mappings, normal balances, tax treatment and golden journals. | Signed accounting policy and approved golden journal suite. | BLOCKED_EXTERNAL |
| P536-04 | P1 | Implement approved reversal requests, maker-checker approval and immutable reversal journals. | Role-separated API/UI tests and audit evidence. | OPEN |
| P536-05 | P1 | Implement inventory cost layers/valuation and link COGS to actual stock issues. | Valuation reconciliation and inventory ledger fixtures. | OPEN |
| P536-06 | P1 | Add general ledger, P&L, balance sheet and cash-flow reports. | Reconciled reporting fixtures and finance acceptance. | OPEN |
| P536-07 | P1 | Complete period close: bank, stock, tax return, unposted-source and suspense review. | Period-close checklist and controlled close/reopen evidence. | OPEN |
| P536-08 | P0 | Run PostgreSQL, API, concurrency/idempotency, browser and dependency-backed build tests. | CI evidence from clean environment. | OPEN — NOT RUN |

## P537 — Trade portal and fulfilment follow-up gaps

| ID | Priority | Gap | Closure evidence | Status |
|---|---|---|---|---|
| P537-01 | P0 | Run supplier/buyer role E2E and tenant IDOR tests for profiles, relationships, catalogue, orders and evidence. | PostgreSQL-backed API security tests and Playwright evidence. | OPEN — NOT RUN |
| P537-02 | P0 | Add inventory availability, allocation/reservation and release on cancellation. | Concurrent order allocation tests and stock ledger reconciliation. | OPEN |
| P537-03 | P1 | Add partial shipment, backorders, line-level received quantities, shortages/damage and supplier returns. | Multi-shipment/partial-receipt workflow tests. | OPEN |
| P537-04 | P1 | Integrate carrier tracking, proof of delivery and secure document storage. | Carrier sandbox, signed POD and retention/access tests. | OPEN |
| P537-05 | P0 | Integrate buyer receipt to GRN, invoice validation, P535 settlement and P536 accounting without duplicate stock/financial effects. | End-to-end procurement-to-ledger reconciliation. | OPEN |
| P537-06 | P1 | Add credit limits/terms, price-list approval, order amendment/versioning and post-acceptance cancellation policy. | Finance-approved policy and role-based tests. | OPEN |
| P537-07 | P0 | Execute migration 239 clean install/upgrade/rollback and append-only trigger tests. | PostgreSQL CI and immutability tests. | OPEN — STATIC ONLY |
| P537-08 | P1 | Complete browser accessibility, mobile responsiveness and buyer/supplier UAT. | Playwright/accessibility reports and signed UAT. | OPEN |

**Register rule:** These gaps remain open until their stated evidence exists. Static checks do not close runtime, legal, security, finance or operational acceptance criteria.

---

# P538 update — POS Device Trust & Attestation Foundation

**Current delivery:** P538 0.538.0-dev — backend developer preview; production acceptance not established.

## P538 delivered scope

- Migration 240: tenant-scoped POS device registry and expiring one-time challenge records.
- Device enrollment with SPKI public key and SHA-256 fingerprint; duplicate active key enrollment is idempotent within an organisation.
- Cryptographically random 256-bit challenge nonce, two-minute expiry and consumption of previous outstanding challenges.
- RSA-SHA256 or ECDSA-SHA256 signature verification against enrolled public key; invalid proof consumes the challenge.
- Trusted status only after valid signature; revocation consumes outstanding challenges and same key cannot be re-enrolled.
- Authenticated, organisation-scoped and permission-gated list/enroll/challenge/attest/revoke API.

## P538 open gaps

| ID | Priority | Gap | Closure evidence | Status |
|---|---|---|---|---|
| P538-01 | P0 | Run RSA/ECDSA valid/invalid signature fixtures, expired challenge, replay and challenge concurrency tests. | PostgreSQL/API integration tests using real key pairs. | OPEN — STATIC ONLY |
| P538-02 | P0 | Integrate Apple App Attest, Android Play Integrity and hardware-backed key attestation. | Platform sandbox evidence and server-side verdict validation. | OPEN — NOT IMPLEMENTED |
| P538-03 | P0 | Bind device identity to secure-time attestation and offline event validation. | Trusted-time protocol, monotonic counter and signed event-chain tests. | OPEN — NOT IMPLEMENTED |
| P538-04 | P1 | Build device administration UI, mobile enrollment, QR/deep-link pairing and recovery. | Mobile/browser E2E and operator UAT. | OPEN — API ONLY |
| P538-05 | P1 | Add device posture, app-version policy, root/jailbreak signals, key rotation and remote revoke workflow. | Device policy tests and security review. | OPEN |
| P538-06 | P0 | Execute migration 240 clean install/upgrade/rollback and tenant IDOR/permission/race tests. | PostgreSQL CI and adversarial API tests. | OPEN — NOT RUN |
| P538-07 | P0 | Obtain legal/excise/finance approval for any offline alcohol sale workflow. | Written jurisdiction-specific approval and operational control sign-off. | BLOCKED_EXTERNAL |

**Safety boundary:** P538 public-key proof is not platform hardware attestation, secure-time proof or evidence of statutory offline-sale eligibility. P538 does not enable offline alcohol posting. P534 legal/tax blockers and P535–P537 runtime/integration gaps remain open.

**Verification:** P538 static checks 14/14 PASS; TypeScript syntax 259 files/0 diagnostics; migration static validation 240 files PASS. PostgreSQL, API, crypto runtime, security, semantic build and browser/mobile tests were not run.

**Register rule:** all open gaps remain open until their specified evidence exists; static checks do not close runtime, legal, security, finance or operational acceptance criteria.

---

# P539 update — Advanced Reports & Business Intelligence

**Current delivery:** P539 0.539.0-dev — reporting UI developer preview; production acceptance not established.

## P539 delivered scope

- Reports navigation now opens a Business Intelligence workspace.
- Date-range filters, executive operational KPIs, daily retail/bar sales trend and top-product ranking.
- CSV export for daily sales trend with escaped values.
- Reuses existing organisation-scoped `finance:view` protected analytics APIs and preserves API date validation.
- Report caveat identifies values as gross POS operational totals, not posted accounting revenue or statutory reports.

## P539 open gaps

| ID | Priority | Gap | Closure evidence | Status |
|---|---|---|---|---|
| P539-01 | P0 | Add outlet/category/payment method/discount/refund/margin dimensions with approved metric definitions. | Source lineage, metric dictionary and API fixtures. | OPEN |
| P539-02 | P1 | Add saved filters, scheduled reports, role-based sharing and scalable server-side exports. | Permission tests, scheduler reliability and export load tests. | OPEN |
| P539-03 | P0 | Implement outlet-local timezone-aware business-day boundaries. | Multi-timezone boundary and DST tests. | OPEN |
| P539-04 | P0 | Reconcile finance/tax/cash/settlement reports to P535/P536 ledgers. | Balanced ledger reconciliation and finance sign-off. | OPEN — UPSTREAM GAPS |
| P539-05 | P1 | Add query plans, indexes, pagination and aggregation for large datasets. | Explain plans and load/performance evidence. | OPEN |
| P539-06 | P1 | Complete semantic build, API/browser/mobile/accessibility and finance UAT. | CI and signed acceptance evidence. | OPEN — NOT RUN |
| P539-07 | P0 | Validate statutory report requirements and obtain jurisdiction-specific review before presenting compliance outputs. | Legal/CA-approved report definitions and reconciliation. | BLOCKED_EXTERNAL |

**Verification:** P539 static checks 10/10 PASS; TypeScript syntax 260 files/0 diagnostics; migration static validation remains 240 files PASS. PostgreSQL/API, semantic build, browser/mobile, accessibility and finance UAT were not run.

**Register rule:** P534–P538 open gaps remain carried forward. P539 operational gross reports are not statutory returns or audited statements.


---

# P540 update — Enterprise Integration Foundation

**Current delivery:** P540 0.540.0-dev — integration registry/outbox backend foundation; production acceptance not established.

## P540 delivered scope

- Migration 241: organisation-scoped integration registry, provider allowlist, HTTPS endpoint constraint and environment-variable credential reference (no secret values stored).
- Durable outbound event outbox with tenant/integration/idempotency uniqueness and retry metadata.
- Delivery-attempt evidence table.
- Authenticated, organisation-scoped, permission-gated APIs to list/create/configure/pause/revoke integrations and inspect event history.
- Pause holds queued events; revoke cancels queued/held/failed events.
- Outbound dispatch intentionally disabled; no provider network calls are made.

## P540 open gaps

| ID | Priority | Gap | Closure evidence | Status |
|---|---|---|---|---|
| P540-01 | P0 | Execute migration 241 on PostgreSQL clean install/upgrade/rollback and verify constraints/indexes. | PostgreSQL CI evidence. | OPEN — STATIC ONLY |
| P540-02 | P0 | Complete tenant IDOR, role permission, concurrent update and API integration tests. | PostgreSQL-backed adversarial API suite. | OPEN — NOT RUN |
| P540-03 | P0 | Implement provider-specific accounting/ERP/delivery/CRM/warehouse adapters and field mappings. | Provider contract tests and sandbox certification. | OPEN — NOT IMPLEMENTED |
| P540-04 | P0 | Implement SSRF-safe egress controls, DNS/IP allowlisting, redirect restrictions, TLS validation, timeouts and request signing before any dispatcher. | Security review and adversarial network tests. | OPEN — BLOCKS DISPATCH |
| P540-05 | P0 | Provision/validate secret references and implement rotation/revocation/credential health checks. | Secret-manager integration and rotation tests. | OPEN |
| P540-06 | P1 | Implement outbox dispatcher, bounded retries, backoff, dead-letter resolution and monitoring. | Duplicate/retry/failure-injection tests. | OPEN — DISPATCH DISABLED |
| P540-07 | P1 | Build integration administration UI and provider setup workflows. | Browser/mobile accessibility and operator UAT. | OPEN — API ONLY |
| P540-08 | P1 | Complete semantic typecheck/build, API/browser tests and provider sandbox UAT. | CI, provider certification and signed UAT. | OPEN — NOT RUN |

**Verification:** P540 static checks 13/13 PASS; TypeScript syntax 261 files/0 diagnostics; migration static validation 241 ordered SQL files PASS. PostgreSQL, API runtime, provider sandbox, browser, semantic build and security tests were not run.

**Safety boundary:** HTTPS scheme validation alone does not prevent SSRF. Outbound dispatch is disabled until safe egress controls, provider certification, signing and operational controls are delivered. P534–P539 open gaps remain carried forward.

**Register rule:** static checks do not close runtime, security, legal, finance, provider or operational acceptance criteria.
