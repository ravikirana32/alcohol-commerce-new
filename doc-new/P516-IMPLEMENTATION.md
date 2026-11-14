# P516 — Retail POS End-to-End

**Version:** `0.516.0-dev`  
**Baseline:** P515 cumulative source  
**Status:** PARTIAL — checkout API existed before P516; this phase improves operator workflow and server-authoritative receipt handling. Runtime verification remains outstanding.

## P516 changes

- Outlet price lookup now includes the product barcode alongside SKU and name.
- Retail POS adds a scan/search field that resolves exact barcode or SKU matches and supports product-name filtering through the configured price list.
- Retail cart supports in-place quantity increment/decrement, with a floor of one, and removal.
- The client continues to send product identifiers and quantities only; the API resolves current outlet price and tax server-side.
- Receipt line amounts and grand total now use the server checkout response rather than recomputing the final receipt solely from client-side cart values.
- Existing idempotency behaviour is preserved: uncertain checkout retries resend the same request body and key; cart editing is locked while confirmation is pending.
- Existing atomic sale transaction continues to write sale, lines, payments, stock movements and audit event together.

## Existing end-to-end API contract retained

- `GET /api/v1/outlets`
- `GET /api/v1/outlets/:outletId/prices?channel=RETAIL`
- `POST /api/v1/retail/sales`
- `GET /api/v1/retail/sales`
- Existing sale detail and refund endpoints remain available through the operations router.

## Known limitations

- No live payment-provider capture is enabled. CASH/UPI/CARD tender rows are internal payment records, not confirmation from a bank or gateway.
- Discounts/manager approval, exchange orchestration, fiscal printer certification and provider settlement are not completed in P516.
- Product variants remain catalogue-only. Variant-specific stock/prices and variant-aware refunds need a dedicated data-model integration before variants are used for sale.
- Barcode input resolves against the currently loaded active outlet price list; it is not a camera-based scanner integration.
- Receipt print uses browser print CSS; no certified fiscal receipt printer integration.
- Runtime database/API/browser verification was not available in this build environment.

## Acceptance status (2026-11-09)

- P516 static acceptance verifier: PASS (10/10).
- TypeScript syntax transpilation: PASS (223 files, zero diagnostics).
- P513 cumulative static verifier: PASS.
- P514 cumulative static verifier: PASS.
- P515 cumulative static verifier: PASS.
- P512 static release-gate checks: PASS.
- P501 deterministic integration gate: PASS (10/10); this is static/deterministic and explicitly leaves productionReady=false.
- P502 refund integrity: PASS (11/11).
- P503 quarantine release checks: PASS (10/10).
- Ordered SQL migration static validation: PASS (217 files).
- PostgreSQL migration/runtime tests: NOT RUN.
- API typecheck/build: BLOCKED by unavailable Node type declarations/dependencies in this environment.
- Web typecheck/build: BLOCKED by unavailable React/JSX type declarations/dependencies in this environment.
- Vitest and Playwright runtime tests: NOT RUN; dependencies/browser runtime are unavailable.
- Authenticated retail checkout, barcode scanning, tender, refund and receipt Playwright E2E: NOT RUN.

P516 is **not production-approved**. Live end-to-end verification and the outstanding business controls above must be completed before production use.
