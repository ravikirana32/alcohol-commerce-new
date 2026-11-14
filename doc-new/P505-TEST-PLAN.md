# P505 Test Plan

| Test | Command | Requirement | Artifact-build status |
|---|---|---|---|
| Docker/env file preflight | `npm run verify:p505:env` | Node.js | Executed |
| PostgreSQL clean install | `npm run verify:p505:postgres` | Disposable PostgreSQL + npm dependencies | Blocked without live PostgreSQL |
| Migration/checksum ledger | Included in PostgreSQL harness | Disposable PostgreSQL | Blocked without live PostgreSQL |
| API/web typecheck and build | `npm run typecheck && npm run build` | Installed npm dependencies | Not claimed |
| API Vitest suite | `npm test` | Installed npm dependencies | Not claimed |
