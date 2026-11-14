# P531 Test Report

## Executed checks

| Check | Result |
|---|---|
| P531 static acceptance | PASS — 31/31 |
| P530 posting regression static verifier | PASS — 22/22 |
| P528 authoritative validation verifier | PASS — 15/15 |
| P529 approval verifier | PASS — 16/16 |
| TypeScript syntax transpilation | PASS — 240 files, 0 syntax diagnostics |
| Migration ordering/static validation | PASS — 230 ordered SQL files |
| Migration preflight | Completed; inherited duplicate prefixes 150, 151, 176, 223 reported |
| ZIP integrity / manifest hashes | To be recorded after package creation |

## Checks not executable in this environment

- API unit tests: not run; `vitest` is not installed (`vitest: not found`).
- TypeScript typecheck: blocked by missing workspace dependencies and type declarations (Express, Zod, pg, Node types, etc.). Syntax transpilation is not a typecheck.
- PostgreSQL migration execution: not run; no live PostgreSQL instance/connection was provided.
- API integration tests: not run.
- Concurrent duplicate posting, same-bottle concurrent peg depletion, same-SKU stock races, transaction rollback and crash/retry tests: not run.
- Browser Playwright E2E and role-based/tenant isolation tests: not run.
- Gateway settlement, accounting journals, tax and excise rule acceptance: not run / out of P531 scope.

## Static acceptance coverage

The P531 verifier asserts supported BAR_CHECKOUT handling, line-type/measure validation, aggregate bottle and stock preflight, row locks, reservations, ticket fingerprint/idempotency, peg transactions, stock movements, KOT creation, offline tender state, posting execution source integrity, terminal block handling, API reservation controls, online checkout reservation protection, operator UI actions, integer measure/paise helpers and P536 journal deferral.

## Conclusion

Static implementation checks pass. Runtime correctness is not established. Keep this release at PARTIAL / developer preview until a CI environment with dependencies and disposable PostgreSQL completes migration, API, concurrency, failure-injection, security and browser tests.
