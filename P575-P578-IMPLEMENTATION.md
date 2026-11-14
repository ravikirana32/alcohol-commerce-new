# P575–P578 Implementation Report

## Baseline
Cumulative P574 (`0.574.0-dev`). This grouped delivery connects inventory costing, procurement returns, payment reconciliation and financial statements.

## P575 — Inventory valuation and FIFO costing
- Migration `251_p575_inventory_cost_layers.sql`.
- FIFO cost layers are created from accepted goods receipt lines and optionally from manual/batch receipts when unit cost is supplied.
- Retail and bar stock checkout consumes FIFO layers in `received_at,id` order with row locks.
- Cost consumption is recorded by stock movement source event and made replay-safe through a unique consumption event record.
- Uncovered quantities are not assigned a fabricated cost; they create cost exceptions.
- Added organisation-scoped valuation and cost-exception read APIs.
- Manual receipts/batches without unit cost are explicitly flagged.

## P576 — Procurement completion
- Migration `252_p576_supplier_returns.sql`; adds explicit `SUPPLIER_RETURN` stock movement type.
- Added supplier return draft/list/approve/post APIs with separate reviewer requirement.
- Posting locks balances, validates on-hand quantity, appends an idempotent stock movement, consumes FIFO cost, and records movement linkage.
- Existing GRN partial accepted/rejected quantities, PO partial receipt states and GRN idempotency retained.

## P577 — Settlement and chargeback reconciliation
- Migration `253_p577_settlement_reconciliation.sql`.
- Added bank statement line import, deduplication, listing and manual settlement matching.
- Exact net amount matches mark the bank statement line MATCHED and settlement batch BANK_CONFIRMED; mismatches remain VARIANCE.
- Added chargeback case create/list/status workflow with organisation/outlet/tender allocation validation.

## P578 — Financial statements and close controls
- Migration `254_p578_financial_statement_controls.sql`; adds period-close evidence and postable account flag.
- Added P&L, balance sheet, cash/bank movement, inventory valuation and cost exception endpoints.
- Balance sheet includes current earnings when reconciling assets against liabilities/equity.
- Manual journals reject inactive/non-postable accounts.
- Period close now records trial-balance totals, individually unbalanced journals and unresolved payment/cost exceptions; period closure is blocked when checks fail.

## Explicit remaining gaps
- Transfer, opening stock, retail refund and open-bottle cost-layer basis propagation.
- Automatic COGS, supplier return, settlement and chargeback journal posting for every operational source.
- Landed cost, full supplier credit note/AP, bank feed/provider certification.
- Cash flow is a direct cash/bank movement summary, not a complete indirect statement.
- UI, runtime database/concurrency, Vitest, semantic typecheck, E2E, IDOR, penetration and finance/legal UAT remain open.
