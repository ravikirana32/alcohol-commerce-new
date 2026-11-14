# P536 — Automated Accounting, Tax Ledger, COGS & Period Controls

**Release:** 0.536.0-dev  
**Baseline:** P535 cumulative 0.535.0-dev  
**Delivery classification:** Backend and admin-workspace developer preview; production acceptance not established.

## Delivered in this phase

1. **Organisation-scoped accounting mappings** for SALES, REFUND, SETTLEMENT, COGS and PURCHASE source events. Account references are constrained to the same organisation; inactive or foreign accounts are rejected.
2. **Idempotent source posting ledger** keyed by organisation, source type and source ID, with a SHA-256 fingerprint. Exact retries return the original posting; changed payloads for the same source identity are rejected.
3. **Balanced double-entry posting engine** creates draft journals and lines in one transaction, validates exact debit/credit equality, then posts the journal. It has posting templates for sales with tax payable, refund tax reversal, provider settlement with fee expense, COGS/inventory reduction and purchases.
4. **Tax payable and immutable P534 tax snapshot reference** are represented as distinct accounting legs. This posting endpoint receives tax amounts from a trusted caller; it does not independently recompute statutory tax.
5. **COGS and inventory ledger legs** use configured expense and inventory accounts. Inventory valuation/cost-layer calculation is not implemented here; a trusted inventory-cost source must supply the amount.
6. **Settlement clearing and provider fee accounting** separates bank payout, provider clearing and MDR/settlement fee expense.
7. **Accounting periods** can be created, listed and closed. Posting is blocked for a date in a CLOSED or LOCKED period. Close requires the finance period-close permission.
8. **Posted journal immutability** at database trigger level; corrections must use a separately approved reversal workflow. Reversal request/approval UI and automated reversal journal generation remain open.
9. **Finance & Accounting admin workspace** for account mapping and period management.
10. **Migration 238**, version 0.536.0-dev, and static regression verifier.

## API surface

- `PUT /api/v1/finance/accounting-mappings/:eventType`
- `POST /api/v1/finance/source-postings`
- `POST /api/v1/finance/periods`
- `GET /api/v1/finance/periods`
- `POST /api/v1/finance/periods/:periodId/close`
- Existing P521 account, manual journal and trial-balance endpoints remain available.

## Posting semantics and limitations

- `SALES`: debit payment clearing for gross; credit revenue net of tax; credit tax payable.
- `REFUND`: debit contra-revenue net of tax and debit tax payable reversal; credit refund tender clearing.
- `SETTLEMENT`: debit bank payout net of fee, debit fee expense, credit provider clearing gross.
- `COGS`: debit COGS and credit inventory using the supplied inventory cost.
- `PURCHASE`: debit configured inventory/purchase account and credit supplier payable account.
- The current source-posting API is a controlled finance operation and requires `finance:manage`. It is **not yet automatically invoked by every retail checkout, bar checkout, refund, GRN, inventory consumption or P535 settlement event**. Integration workers and trusted source adapters remain required before claiming end-to-end automation.
- The request amount and tax/fee/cost payload must be supplied by a trusted, authorised source. The API does not yet fetch and independently reconcile the original sale, P534 snapshot, P535 tender/settlement or inventory valuation record.
- Account mapping correctness, normal-balance conventions and statutory treatment require accountant/CA approval. No statutory tax rate is seeded or assumed.
- The period-close workflow does not yet provide full bank reconciliation, stock valuation reconciliation, tax return reconciliation or comprehensive unposted-source queue review.
- Reversal approval, audit drill-down, general ledger UI, P&L, balance sheet, cash flow and accountant sign-off remain open.
- P534/P535 external and runtime blockers are carried forward. Offline alcohol financial posting remains subject to P538 secure-time/device attestation and compliance gates.

## Verification

- P536 static checks: 15/15 PASS.
- P535 regression static checks: 14/14 PASS.
- TypeScript syntax transpilation: 257 files, 0 diagnostics.
- SQL migration static validation: 238 ordered SQL files PASS.
- PostgreSQL migration execution, API integration, dependency-backed typecheck/build, browser E2E, accounting golden fixtures, concurrent idempotency, and qualified accountant/legal review were not run in this environment.

**Release status:** developer preview only; not production-approved.
