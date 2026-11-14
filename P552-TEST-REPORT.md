# P552 Test Report

**Version:** 0.552.0-dev

| Check | Result | Evidence |
|---|---:|---|
| P552 API route permission parity | 8/8 PASS | `node scripts/verify-p552-api-permission-parity.mjs` |
| API routes inventoried | 227 | Generated `P552-API-ROUTE-PERMISSION-MATRIX.json` |
| Routes with direct/inherited permission | 216 | Static scan |
| Explicitly exempt routes | 11 | Named allowlist with rationale |
| Unclassified routes | 0 | Static scan |
| Migration-derived roles | 13 | Regenerated permission matrix |
| Migration-derived permission codes | 100 | Regenerated permission matrix |
| P549 permission verifier | 11/11 PASS | `node scripts/verify-p549-permissions.mjs` |
| P551 workspace authorization verifier | 43/43 PASS | `node scripts/verify-p551-workspace-actions.mjs` |
| P550 action verifier | 17/17 PASS | `node scripts/verify-p550-actions.mjs` |
| P548 navigation verifier | 12/12 PASS | `node scripts/verify-p548.mjs` |
| P547 RBAC verifier | 11/11 PASS | `node scripts/verify-p547-rbac.mjs` |
| TypeScript syntax scan | 269 files, 0 diagnostics | `node scripts/check-typescript-syntax.mjs` |
| SQL migration static validation | 242 files PASS | `python3 scripts/verify-migrations.py` |
| ZIP integrity | PASS | `zipfile.testzip()` |

## Not run

- PostgreSQL clean install, upgrade and live role grant comparison.
- Vitest execution, full API/web typecheck and production build.
- Playwright/browser tests and login matrix for all seeded users.
- Live API allow/deny matrix, tenant/outlet/resource IDOR and penetration testing.

Static checks are not runtime security evidence. Production remains NO-GO.
