# P568 Test Report

| Check | Result | Detail |
|---|---|---|
| P568 request-idempotency static verifier | PASS | 10/10 |
| P567 workflow adoption verifier | PASS | 10/10 |
| P566 stock idempotency verifier | PASS | 10/10 |
| P565 stock ledger verifier | PASS | 11/11 |
| P564 tenant mutation verifier | PASS | 14/14 |
| TypeScript syntax transpilation | PASS | 274 files, 0 diagnostics |
| SQL migration static validation | PASS | 244 ordered SQL migrations |
| Vitest | BLOCKED | `vitest: not found`; dependencies are not installed |
| API TypeScript semantic typecheck | BLOCKED | Missing workspace dependencies/types (`express`, `@types/node`, etc.) |
| PostgreSQL migration/runtime | NOT RUN | Docker command unavailable |
| Concurrent duplicate request tests | NOT RUN | Requires PostgreSQL runtime |
| Browser E2E / tenant IDOR / penetration | NOT RUN | Separate acceptance environment required |
| ZIP integrity | Pending packaging | Recorded in release manifest after archive creation |

Static checks validate source invariants only. They do not establish database execution, transactional isolation, HTTP behaviour or production readiness.
