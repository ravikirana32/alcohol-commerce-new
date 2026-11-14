# P562 — Tenant-Scope Remediation for Shift Reconciliation Reads

## Baseline
P561 cumulative v0.561.0-dev.

## Scope delivered
Reviewed the shift preview and shift close reconciliation reads in `apps/api/src/routes/operations.ts`. The source migrations confirm `organisation_id` on `sale_payments`, `retail_sales`, `bar_payments`, `bar_tickets`, `retail_refunds`, `bar_refunds`, and `shift_cash_movements`, plus `outlet_id` on refund and cash-movement ledgers.

Added explicit tenant predicates to eight SQL read statements (four in shift preview and four in shift close):
- Retail tender aggregation constrains both payment and sale rows to the authenticated organisation and the selected outlet.
- Bar tender aggregation constrains both payment and ticket rows to the authenticated organisation and the selected outlet.
- Cash movement aggregation constrains organisation, outlet and shift.
- Cash refund aggregation constrains both retail and bar refund ledgers by organisation and outlet.

The existing shift lookup remains organisation-scoped. Parameter bindings were extended to supply the authenticated organisation ID; no caller-supplied organisation identifier was introduced.

## Safety notes
This is a narrow remediation based on verified schema columns and the existing organisation-scoped shift lookup. It does not prove all joins, report queries, or other SQL paths are tenant-safe. No migrations or role grants were changed.
