# P515 — Product Catalogue and Pricing

**Version:** `0.515.0-dev`  
**Baseline:** P514 cumulative source  
**Status:** PARTIAL — implementation and static acceptance complete; live database/API/browser verification outstanding.

## Implemented

- Organisation-scoped product category list/create/update, parent validation, active/archive lifecycle and category description.
- Organisation-scoped brand list/create/update and active/archive lifecycle.
- Expanded product create/list/update with category, brand, product type, barcode, pack size, case quantity, ABV, HSN/tax codes, tax rate, description and image URI.
- Product search by name, SKU and barcode; active/archived/all filters.
- Organisation-scoped unique SKU, product barcode, variant code and variant barcode constraints.
- Product variant list/create/update/archive with independent barcode, pack size and case quantity.
- JSON catalogue export and bounded (500-row) create-only JSON import with row-level errors and transaction safety.
- Outlet product price history endpoint. Existing price-writing workflow retains superseded price rows with effective-from/effective-until timestamps.
- Catalogue workspace wired into the authenticated Products navigation: product creation, search, archive/reactivate, category and brand creation, JSON import/export.
- Migration `218_p515_catalogue_pricing.sql` and static acceptance verifier `scripts/verify-p515.mjs`.

## API endpoints

- `GET/POST /api/v1/catalogue/categories`
- `PATCH /api/v1/catalogue/categories/:id`
- `GET/POST /api/v1/catalogue/brands`
- `PATCH /api/v1/catalogue/brands/:id`
- `GET/POST /api/v1/catalogue/products`
- `PATCH /api/v1/catalogue/products/:productId`
- `GET /api/v1/catalogue/products/export`
- `POST /api/v1/catalogue/products/import`
- `GET/POST /api/v1/catalogue/products/:productId/variants`
- `PATCH /api/v1/catalogue/variants/:variantId`
- `GET /api/v1/outlets/:outletId/prices/history?productId=<uuid>`

All routes require authentication, organisation scope and the appropriate catalogue permission. The catalogue router is mounted before the legacy catalogue handlers so the expanded endpoints are authoritative.

## Known limitations / gaps

- Import/export currently uses JSON, not CSV/XLSX. This is intentional for the first safe implementation; spreadsheet support remains a follow-on requirement if needed.
- Product image field stores a validated URI only. Secure upload/storage, virus scanning, transformations and lifecycle cleanup are not implemented.
- Price history is exposed read-only. Price approval workflows, scheduled future price books and bulk price changes remain outstanding.
- Product variants are managed as catalogue records; checkout, inventory, receipts and refunds are not yet variant-aware. Do not use variants for live sales until P516/P518 integrate them end-to-end.
- Product type/HSN/tax fields are configurable data, not a legal determination of applicable Karnataka excise or GST treatment. Obtain professional review.
- Product create/import supports catalogue rows, but import row errors currently do not provide an XLSX/CSV error file.
- Runtime migration execution, API integration tests, dependency-backed typecheck/build and Playwright E2E were not run because no verified PostgreSQL/API runtime and installed dependencies were available.

## Acceptance status

- P515 static verifier: PASS.
- TypeScript syntax transpilation: 223 files, zero diagnostics.
- Migration static validation: PASS (static-only).
- Inherited P501 deterministic integration gate: 10/10.
- P502 refund integrity: 11/11.
- P503 quarantine checks: 10/10.
- P512 static release gates: PASS; production gate remains closed.
- PostgreSQL clean install/upgrade: NOT RUN.
- Full TypeScript typecheck/build: NOT RUN.
- API and browser E2E: NOT RUN.

P515 is **not production-approved** until those runtime gates pass and catalogue-to-checkout/inventory integration is verified.
