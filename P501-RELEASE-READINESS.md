# P501 Integration Baseline and Release Readiness

Version: `0.501.0-dev`  
Baseline: P500.9 cumulative  
Status: `INTEGRATED_DEVELOPER_PREVIEW — NOT PRODUCTION READY`

## Integrated workflows in this baseline

- Retail POS: multi-line cart, server-resolved price/tax, stock deduction, split tenders, idempotency fingerprint, receipt preview/print.
- Retail history: outlet-scoped sale list/detail, tender/refund history and permission-gated refund entry.
- Bar POS: multi-line PEG/BOTTLE/PACKAGED ticket, open-bottle deduction, split tenders and canonical idempotency fingerprint.
- Bar history: ticket list/detail and permission-gated refunds; peg ml is not automatically restored by a refund.
- Shift management: open shift, cash-in/cash-out, retail/bar cash tender preview, declared cash and close variance.
- Inventory: outlet stock balance, receipts and reason-coded adjustments with stock ledger movements.
- AI remains disabled by default. Consumer alcohol transactions remain disabled unless expressly lawful and licensed.

## P501 integration hardening

- Bar idempotency race replay now reconstructs fingerprints for legacy rows before accepting a retry.
- POS distinguishes definitive 4xx responses from uncertain transport/5xx failures: definitive client errors release the pending request for correction; uncertain failures retain the exact request and idempotency key.
- Added one deterministic integration gate: `npm run verify:p501`.
- Added machine-readable `P501-INTEGRATION-VERIFICATION.json`.

## Verification

Run:
```bash
npm install
npm run verify:p501
npm run typecheck
npm test
npm run build
```

Static/deterministic checks are run by `verify:p501`. A successful static gate is not proof of runtime correctness.

### P501 dependency-backed attempts

- `npm install --ignore-scripts --no-audit --no-fund` was interrupted by the execution time limit after 60 seconds; no complete `node_modules` or package lock was produced.
- API typecheck and build were attempted and failed because Node type declarations were unavailable (`process` and `node:crypto` type errors).
- Vitest was attempted but its executable returned `Permission denied`; tests are not claimed as run.
- PostgreSQL migration execution and browser E2E were not run.

## Mandatory pre-pilot gates still open

1. Install dependencies successfully and run full TypeScript typecheck, Vitest and production build.
2. Apply all migrations to a clean disposable PostgreSQL database and to an upgrade copy; test rollback/restore.
3. API integration tests against PostgreSQL for retail/bar checkout, concurrent stock/peg deduction, idempotency replay, refunds, shift close and tenant isolation.
4. Browser E2E: login → outlet selection → product/price → retail cart → split tender → receipt → refund → shift close; and bar PEG/BOTTLE/PACKAGED → ticket → refund.
5. Verify role permissions and least-privilege behaviour for each organisation/outlet role.
6. Run security review, dependency audit, rate-limit/abuse tests, backup/restore drill, monitoring and incident-response drill.
7. Validate Karnataka excise permissions and operational requirements with qualified local counsel/authorities for each outlet and licence type.
8. Obtain payment provider, receipt printer, barcode scanner and cash drawer certification where used.
9. Conduct authorised outlet pilot and obtain written operational sign-off.

## Known limitations

- Retail refund restock is proportional by refund value, not SKU/quantity allocated.
- Bar refund does not automatically reverse peg volume; physical adjustment is separate.
- Inventory screen posts receipts and adjustments only; purchase orders, supplier invoices, three-way matching, stocktake and AP integration remain open.
- No live database, API/browser E2E, load/concurrency, legal or pilot verification is claimed in this package.


## P501 tooling correction

The TypeScript syntax checker now skips generated `dist`, `node_modules`, `coverage` and `.git` directories and excludes declaration-only `.d.ts` files. This prevents partial compiler output from being mistaken for source files during a subsequent syntax scan. The final source-only scan covers 215 `.ts`/`.tsx` files with zero syntax diagnostics.
