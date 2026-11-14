# P575–P578 Runbook

## Database upgrade
On a disposable/test PostgreSQL database:
```bash
export DATABASE_URL='postgres://...'
npm ci
npm run db:migrate
npm run db:status
```
Migrations added: 251–254. Do not apply to production without approved change control and backup.

## FIFO costing
- Goods receipt lines create FIFO cost layers from accepted quantity and unit cost.
- Manual inventory receipts and batch receipts accept optional `unitCost`; omit it only when the receipt must remain explicitly unvalued.
- Retail/bar checkout consumes FIFO layers automatically in the same transaction as stock movement.
- Inspect `GET /api/v1/finance/inventory-valuation` and `GET /api/v1/finance/inventory-cost-exceptions`.
- Uncovered cost is never guessed. Resolve exceptions only with approved source evidence and a controlled cost adjustment process.

## Supplier returns
- Create `POST /api/v1/procurement/supplier-returns`.
- Approve `POST /api/v1/procurement/supplier-returns/:returnId/approve` as a different user.
- Post `POST /api/v1/procurement/supplier-returns/:returnId/post`.
- Posting decrements stock, appends SUPPLIER_RETURN movement and consumes FIFO cost in one transaction.

## Bank statement and chargeback operations
- Import lines: `POST /api/v1/finance/bank-statement-lines`.
- List: `GET /api/v1/finance/bank-statement-lines`.
- Match: `POST /api/v1/finance/bank-statement-lines/:lineId/match` with `settlementBatchId`.
- Chargeback create/list/status endpoints are under `/api/v1/finance/chargebacks`.
- These are evidence workflows; no direct bank feed or live provider capture is enabled.

## Financial statements
- `GET /api/v1/finance/profit-and-loss?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /api/v1/finance/balance-sheet?asOf=YYYY-MM-DD`
- `GET /api/v1/finance/cash-flow?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /api/v1/finance/trial-balance?from=YYYY-MM-DD&to=YYYY-MM-DD`
- Period close records check evidence and blocks on imbalance/unresolved payment or cost exceptions.

Cash-flow endpoint is currently a direct cash/bank movement summary, not a complete indirect cash-flow statement.
