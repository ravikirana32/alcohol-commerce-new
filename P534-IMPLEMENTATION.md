# P534 — Tax, GST, Cess & Pricing Engine

**Release:** 0.534.0-dev  
**Baseline:** P533 cumulative (0.533.0-dev)  
**Delivery status:** TECHNICAL IMPLEMENTATION COMPLETE FOR DEVELOPER PREVIEW; EXTERNAL ACCEPTANCE BLOCKED.  
**Production approval:** NO.

## Delivered scope

- Migration 233: effective-dated jurisdiction tax packs, components, product tax profiles, outlet tax prices, immutable calculation snapshots and append-only attempts.
- Rule-pack draft/component/submit/independent-review/third-distinct-admin activation lifecycle and associated APIs.
- Verified product profile and independently reviewed outlet price APIs and Tax & Pricing admin workspace.
- Server-side tax calculation for inclusive/exclusive percentage, pure-alcohol litre, bulk litre, fixed-per-unit and price-slab components.
- MRP/menu-ceiling, alcohol GST exclusion, CGST/SGST pair and IGST conflict safeguards.
- Retail and bar checkout call the authoritative tax quote service within their existing transaction and persist tax snapshot references (migration 234). No legacy tax-rate fallback.
- BAR price measures PEG/BOTTLE/PACKAGED (migration 235); PEG quote volume validation.
- Jurisdiction match between outlet state and product tax profile.
- Effective-period overlap guards and transaction-scoped advisory locks (migration 236).
- Updated static acceptance, retail checkout and bar ticket/refund verification scripts.

## Verification performed for final P534 candidate

- P534 static acceptance: 36/36 PASS.
- Retail checkout integration verifier: 17/17 PASS.
- Bar ticket/refund verifier: 9/9 PASS.
- P533 excise regression: 24/24 PASS (as recorded in the phase verification report).
- TypeScript syntax transpilation: 253 files, zero syntax diagnostics.
- Migration static validation: 236 ordered SQL files PASS.
- Archive integrity and SHA-256 checksum verified after packaging.

These are static checks and pure-function checks. They are not a substitute for runtime tests.

## Acceptance gaps that cannot be closed in this environment

1. **PostgreSQL runtime:** migrations 233–236 have not been executed on a clean database or a P533 upgrade database. Rollback/reapply, FK/check constraints, append-only triggers and advisory-lock concurrency need a live PostgreSQL test.
2. **Dependency-backed checks:** Vitest and semantic API/web typechecks were not run because dependencies/type declarations are unavailable; dependency installation did not complete within the environment limit.
3. **API/browser/security:** API integration, Playwright E2E, tenant IDOR, permission matrix, race/failure injection and performance tests were not run.
4. **Finance acceptance:** no finance-approved multi-line invoice rounding/settlement/journal fixtures or tax-to-ledger reconciliation evidence is available. Payment settlement and balanced journal integration remain P535/P536 work.
5. **Jurisdiction:** interstate/place-of-supply and other-state rule packs are not implemented. The engine requires outlet/profile jurisdiction match and fails closed on mismatch.
6. **Statutory/legal:** no official current Karnataka tax/excise rate schedule has been supplied and verified. No statutory rates are invented or activated. Qualified local legal/excise counsel and CA/accounting approval are required.
7. **Offline alcohol sales:** remain disabled pending secure-time/device attestation (P538) and legal/security/finance gates.

## Release boundary

P534 is technically delivered as a developer-preview tax configuration and checkout-calculation foundation. It is **not production-approved** and cannot truthfully be marked fully accepted until the runtime, security, finance and statutory/legal evidence above is obtained. Keep tax packs DRAFT unless supported by official source evidence and independent approvals. Do not use this phase alone for statutory filing, interstate supply or production alcohol sales.
