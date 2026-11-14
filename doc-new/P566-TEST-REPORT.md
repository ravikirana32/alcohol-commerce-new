# P566 Test Report

## Static checks
- Static verifier: 10 assertions covering migration shape, tenant/outlet key scope, conflict-safe insert, fingerprint conflict, append-only behavior and test coverage.
- Migration ordering: new migration is numbered 243 after the current 242 migration files.

## Unit tests added (not executed here)
`apps/api/src/services/stockMovementIdempotency.test.ts` covers:
1. stable fingerprints;
2. first insert;
3. identical replay;
4. same key/different payload rejection;
5. malformed key and non-positive quantity rejection.

## Not run / acceptance required
- Vitest execution (dependencies may need installation).
- PostgreSQL migration on clean and upgraded databases.
- Concurrent duplicate requests against PostgreSQL.
- Integration of helper into each stock-posting workflow.
- Cross-organisation/outlet IDOR, Playwright and penetration tests.

Static checks are not runtime proof. Production remains NO-GO.

## Execution observed in this build
- P566 static verifier: 10/10 PASS.
- TypeScript syntax transpilation: 274 files, 0 diagnostics.
- P565 stock-ledger verifier: 11/11 PASS.
- P564 static verifier: 14/14 PASS.
- SQL migration static validation: 243 ordered files PASS.
- Vitest command attempted but could not execute: `vitest: Permission denied` (exit 127). The tests are authored, not passed.
