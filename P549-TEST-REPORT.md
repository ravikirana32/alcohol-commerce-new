# P549 Test Report

## Executed

| Check | Result | Evidence |
|---|---|---|
| Permission matrix static verifier | 11/11 PASS | `node scripts/verify-p549-permissions.mjs` |
| TypeScript syntax transpilation | 268 files, 0 diagnostics | `node scripts/check-typescript-syntax.mjs` |
| SQL migration static validation | 242 ordered files PASS | `python3 scripts/verify-migrations.py` |

## Not executed

- PostgreSQL runtime role/permission export and comparison.
- API/Vitest permission suite (`npm run test:permissions:p549`).
- Frontend production build/typecheck.
- Browser tests for each seeded demo account.
- Cross-organisation and cross-outlet IDOR tests.

The 11/11 result is a deterministic source-level verifier only. It does not prove live authorization correctness.
