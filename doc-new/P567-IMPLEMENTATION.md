# P567 — Stock Movement Idempotency Integration Across Business Workflows

## Implemented integrations
The P566 append-once helper is now used inside the existing transaction for:
- Retail checkout: stable sale + line-index key.
- Bar checkout: stable ticket + line-index key.
- Offline retail posting: source event + line-index key.
- Offline bar posting: source event + line-index key.
- Stock transfer dispatch and receipt: transfer + stock-transfer-line + direction key.
- Stocktake approval: stocktake + stocktake-line key.
- Inventory batch receipt: batch identity key.
- Goods receipt posting: persisted goods-receipt-line identity key.

Each integration preserves the workflow's existing stock balance update and source-document transaction. The helper appends the movement record and checks replay fingerprint consistency.

## Deliberately not converted
Three `operations.ts` movement inserts remain:
- Manual stock receipt endpoint.
- Manual stock adjustment endpoint.
- Open-bottle source movement endpoint.

These require a stable client/source-event identity to be introduced without silently breaking existing API clients. They remain explicitly open; P567 does not claim complete workflow adoption.

## Important retry semantics
For retail/bar/offline/transfer flows, the source business object already has a stable identity or state transition and is created/locked in the same transaction. For goods receipts, the key is based on the persisted receipt-line ID; a client retry that creates a new receipt is not deduplicated by this key and still needs an API-level receipt idempotency key. P567 therefore improves movement-level duplicate protection but is not an end-to-end request idempotency guarantee for every workflow.

## Files
- Updated route integration in operations, barCheckout, offlineLedgerPosting and procurement.
- `scripts/verify-p567-stock-workflow-adoption.mjs`
- `P567-IMPLEMENTATION.md`, test report, runbook, status and release notes.
