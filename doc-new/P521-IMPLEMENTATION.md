# P521 — Finance and Accounting Foundation

**Version:** 0.523.0-dev  
**Baseline:** P520 cumulative source  
**Status:** PARTIAL — backend foundation and static verification only; no production approval.

## Implemented
- Organisation-scoped chart of accounts with ASSET, LIABILITY, EQUITY, INCOME and EXPENSE account types.
- Organisation-scoped journal headers and journal lines.
- Debit/credit one-sided line validation and transactional journal posting API.
- Active account and outlet ownership validation.
- Deferred database constraint trigger intended to enforce non-zero balanced posted journals.
- Trial-balance API filtered by posted journal date.
- `finance:view` and `finance:manage` permission seeds for owner/manager roles.
- `P513-ONWARD-GAP-REGISTER.md`, a cumulative phase-by-phase remediation backlog covering P513 through P521 and cross-phase P512 release blockers.

## API
- `GET /api/v1/finance/accounts`
- `POST /api/v1/finance/accounts`
- `POST /api/v1/finance/journals`
- `GET /api/v1/finance/trial-balance?from=YYYY-MM-DD&to=YYYY-MM-DD`

## Not implemented / outstanding
- Automatic journal posting from sales, bar checkout, refunds, procurement, GRNs and reconciliation.
- GST tax ledgers and statutory returns.
- Finance UI, general ledger drill-down, P&L, balance sheet and cash flow.
- Period close, reversal approvals, cost centres, COGS and inventory valuation.
- Accountant-approved chart of accounts and tax mapping.
- PostgreSQL runtime execution, dependency-backed typecheck/build, API integration and browser E2E.

## Verification
Static acceptance and syntax/migration checks are listed in `P521-STATUS.md`. Static checks are not runtime proof. The release remains developer preview.
