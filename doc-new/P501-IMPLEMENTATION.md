# P501 — Integrated retail, bar, inventory and shift baseline

Version: `0.501.0-dev`  
Status: developer preview; not production approved.

## Implemented
- Unified retail and bar POS with multi-line carts, split tenders and receipt preview.
- Unified retail sales/refunds and bar ticket/refunds workspaces.
- Integrated shift opening, cash movements, expected cash and closing variance.
- Integrated inventory balance, receipt and adjustment workspace.
- Hardened legacy bar idempotency race replay using stored or reconstructed request fingerprints.
- Improved POS retry behaviour: definitive 4xx responses release the pending request for correction; uncertain transport/5xx failures preserve the same idempotency key.
- Added `npm run verify:p501` deterministic integration gate and machine-readable verification results.

## Verification
- P501 deterministic integration gate: 10/10 commands passed.
- Retail/bar checkout integration checks: 15/15.
- Shift checks: 9/9.
- Retail sales/refund checks: 9/9.
- Bar ticket/refund checks: 9/9.
- Inventory checks: 8/8.
- TypeScript/TSX syntax transpilation: 215 files, zero syntax diagnostics.
- Retail fingerprint runtime assertions previously passed 5/5; bar fingerprint runtime assertions passed 4/4.
- Migration static ordering: 212 SQL files passed.

## Limitations
- npm dependency installation was interrupted by the execution limit; workspace dependencies are not fully installed.
- API typecheck and build failed because Node type declarations were unavailable.
- Vitest did not execute because the executable returned permission denied.
- No PostgreSQL migration execution, API/browser E2E, load/concurrency, hardware, security, legal or pilot certification.
- Retail refund restock remains proportional by refund value; bar refund does not automatically restore peg ml.
- Supplier purchase orders, invoice matching, stocktake and AP integration remain incomplete.
