# P522 — Reports and Analytics

**Version:** 0.523.0-dev  
**Baseline:** P521 cumulative source  
**Status:** PARTIAL — read-only reporting API foundation; no production approval.

## Implemented
- Authenticated, organisation-scoped reporting router protected by `finance:view`.
- Date-range validation and optional outlet filtering.
- Cross-domain operational overview: completed retail sales, paid bar tickets, stock movements and purchase-order totals.
- Daily retail/bar sales trend.
- Top products by recorded gross line sales across retail and bar.
- Inventory movement summary by outlet, product and movement type.
- Profit-and-loss view derived only from posted finance journals.
- Explicit caveat in P&L response that incomplete source-system postings mean this is not a statutory or complete financial statement.

## API
- `GET /api/v1/reports/overview?from=YYYY-MM-DD&to=YYYY-MM-DD&outletId=<uuid>`
- `GET /api/v1/reports/sales-trend?from=...&to=...&outletId=<uuid>`
- `GET /api/v1/reports/top-products?from=...&to=...&outletId=<uuid>`
- `GET /api/v1/reports/inventory-movements?from=...&to=...&outletId=<uuid>`
- `GET /api/v1/reports/finance/profit-and-loss?from=...&to=...&outletId=<uuid>`

## Important semantics and limitations
- POS gross sales use COMPLETED retail sales and PAID bar tickets. These are operational gross totals, not accounting revenue.
- Trend output omits dates with no transactions; consumers should fill zero days for chart display if required.
- Top-product results use recorded line totals and do not calculate margin or COGS.
- Inventory report aggregates movement records; it is not an on-hand stock valuation or expiry/FEFO report.
- P&L is only as complete as posted finance journals. P521 automatic sales/refund/procurement postings remain outstanding.
- No dashboard UI, CSV/XLSX/PDF export, saved reports, scheduled delivery, custom metrics, role-specific report builder or chart widgets are included.
- Query performance/index review and large-tenant load testing remain outstanding.
- Verify the `outlets.name` and legacy table compatibility against the target PostgreSQL schema before runtime acceptance.

## Verification
- `npm run verify:p522` — static source acceptance.
- Run cumulative verifiers, TypeScript syntax scan and migration static validation as documented in the runbook.
- PostgreSQL query execution, dependency-backed typecheck/build, API integration, browser E2E, tenant isolation and performance tests have not been run.

Release remains developer preview and not production-approved.
