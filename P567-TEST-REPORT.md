# P567 Test Report

## Executed checks
- P567 static workflow-adoption verifier: 10/10 PASS.
- P566 static verifier: 10/10 PASS.
- P565 stock-ledger verifier: 11/11 PASS.
- P564 static verifier: 14/14 PASS.
- TypeScript syntax transpilation: 274 files, 0 diagnostics.
- SQL migration static validation: inherited migration 243 remains in sequence.

## Tests not executed
- Vitest unit suite: P566 attempt failed with `vitest: Permission denied`; P567 did not claim a pass.
- PostgreSQL migration/runtime and concurrent posting tests: not run.
- API end-to-end retries, Playwright, tenant/outlet IDOR and penetration tests: not run.

## Remaining integration gaps
Manual stock receipt, manual adjustment and open-bottle posting still write directly to stock_movements. Goods receipt line key uses a newly persisted receipt-line ID, so request-level replay with a newly-created receipt is not deduplicated. Those are explicitly carried forward.

- API TypeScript semantic typecheck attempted; blocked by missing workspace dependencies/types (`@types/node`, `pg`, `vitest`) and package installation state. The P567 test import was corrected to ESM `.js` specifier; full typecheck remains unverified.
