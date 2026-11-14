# P502 — Refund inventory allocation integrity

**Version:** `0.502.0-dev`  
**Status:** Developer preview; not production certified.

## Delivered

### Retail refunds — SKU/line quantity allocation
- Removed proportional restock based on refund monetary value.
- A restock request must now carry explicit `saleLineId` + returned `quantity` allocations.
- Each allocation is checked against the original sale line and the cumulative quantity already restocked across prior refunds.
- Duplicate line allocations, unrelated sale lines, missing allocations, and quantities above the original sold quantity are rejected.
- Successful returns write `retail_refund_restock_lines`, increment the matching outlet/SKU balance and create a `RETURN` stock movement in the same transaction.
- Sales detail returns cumulative restocked quantity per line; UI shows available quantity and accepts exact SKU quantities.

### Bar refunds — returned peg volume
- Bar refund requests can include `ticketLineId` + `volumeMl` for physical returned volume.
- Allocations must target an original PEG line and cumulative volume cannot exceed the quantity × measure volume sold on that line.
- Each accepted volume is recorded in `bar_refund_peg_restorations` and the peg adjustment ledger.
- **Food/beverage safety boundary:** returned/served liquid is never poured back into a saleable open bottle and never increases `open_bottles.remaining_ml`. It is recorded as `QUARANTINE_PENDING` for documented manager/compliance disposition. A cash refund alone does not imply physical return or volume recovery.
- Bar ticket detail exposes cumulative quarantined volume; UI captures volume by original ticket line.

## Migration
- `apps/api/src/db/214_p502_refund_inventory_allocations.sql`

## Verification
- `scripts/verify-p502-refund-integrity.mjs`
- `scripts/check-typescript-syntax.mjs`
- `scripts/verify-migrations.py`
- `scripts/verify-p501-integration.mjs`

These are static/deterministic checks only. A PostgreSQL-backed clean install and upgrade, full dependency install, typecheck/build, Vitest, API integration and browser E2E still need to run in a provisioned environment.
