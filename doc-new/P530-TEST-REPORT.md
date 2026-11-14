# P530 Test Report

| Check | Result | Evidence |
|---|---|---|
| P530 static acceptance | PASS 21/21 | `node scripts/verify-p530.mjs` (API and operator UI invariants) |
| TypeScript syntax transpilation | PASS — 238 files, 0 diagnostics | `npm run check:syntax` |
| Migration ordering/static validation | PASS — 229 ordered SQL files | `npm run verify:migrations` |
| Migration preflight | WARN — 229 migrations; known duplicate numeric prefixes 150, 151, 176 and 223 | `npm run preflight:migrations` |
| P513–P521 inherited static verifiers | PASS | `scripts/verify-p513.mjs` through `verify-p521.mjs` |
| P522–P529 inherited static verifiers | FAIL only on historical phase-specific version assertions (13/14, 13/14, 9/10, 10/11, 14/15, 15/16) | Existing scripts assert their own historical release version; functional assertions passed in each output |
| PostgreSQL migration execution | NOT RUN | Requires disposable PostgreSQL |
| API integration / auth / tenant isolation | NOT RUN | Requires running API and PostgreSQL fixtures |
| Stock concurrency / crash retry | NOT RUN | Requires multi-session PostgreSQL integration tests |
| Browser E2E | NOT RUN | Requires running web/API/PostgreSQL |
| Finance journal reconciliation | NOT IMPLEMENTED IN P530 | Planned P536 |

No runtime flow is represented as verified until the corresponding tests run against a live environment. Release remains PARTIAL / developer preview.
| Workspace TypeScript typecheck | BLOCKED — exits 2 because workspace dependencies and Node/Express/Zod/PG type declarations are absent (`npm ci` not run; network/install unavailable) | `npm run typecheck` |
