# P518 — Inventory and Warehouse Management

Version: `0.518.0-dev`  
Status: `PARTIAL — developer preview; runtime/database acceptance pending`

## Delivered
- Organisation-scoped warehouse transfer creation and listing.
- Dispatch transaction locks the transfer and stock balance rows, checks available on-hand quantity, deducts source stock, and records `TRANSFER_OUT` movements.
- Receipt transaction validates all transfer lines, prevents receipt above dispatched quantity, credits destination stock, records `TRANSFER_IN`, and requires a reason for shortages.
- Physical stocktake snapshot, count-line editing, submission, and approval. Approval applies count variances as stock ledger adjustments. Approval rejects a stale snapshot if stock changed after counting.
- Batch register with lot number, received/remaining quantity, expiry date, and bounded expiry visibility query.
- Inventory workspace supports transfer creation, dispatch, full receipt confirmation, and stocktake initiation.

## API
- `GET/POST /api/v1/inventory/transfers`
- `GET /api/v1/inventory/transfers/:transferId`
- `POST /api/v1/inventory/transfers/:transferId/dispatch`
- `POST /api/v1/inventory/transfers/:transferId/receive`
- `GET/POST /api/v1/inventory/stocktakes`
- `GET /api/v1/inventory/stocktakes/:stocktakeId`
- `PUT /api/v1/inventory/stocktakes/:stocktakeId/lines/:productId`
- `POST /api/v1/inventory/stocktakes/:stocktakeId/submit`
- `POST /api/v1/inventory/stocktakes/:stocktakeId/approve`
- `GET/POST /api/v1/inventory/batches`

Existing `inventory:read`, `inventory:adjust`, and `inventory:receive` permissions protect these endpoints. Organisation ownership is checked for source/destination outlets and products.

## Not yet delivered
- Batch-aware FIFO/FEFO allocation and decrement during retail/bar checkout.
- Automated expiry notifications and scheduled reorder alerts.
- Reorder-point configuration and suggested purchase orders.
- Multi-line editing, partial receipt UI, variance review UI, stocktake line-entry/approval UI, and manager separation-of-duties policy.
- Wastage/breakage dedicated UI; pre-existing service policies are not a substitute for complete workflow integration.
- Weighted-average/FIFO cost valuation integration and procurement invoice-to-batch linkage.

## Safety and accounting notes
- Transfer dispatch and receipt are distinct transactions; stock is not available at destination until receipt is confirmed.
- A shortage is represented as a transfer variance; the operator must provide a reason.
- Stocktake approval only applies when the live balance still equals the snapshot's expected quantity. Otherwise the count must be repeated to avoid overwriting intervening sales/receipts.
- Batch register quantities currently mirror receipts but are not yet the source of truth for checkout deductions. Do not use lot expiry records as proof of FEFO enforcement.
