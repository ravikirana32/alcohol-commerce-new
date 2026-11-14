# P544 Test Report

| Check | Result | Evidence |
|---|---|---|
| Deterministic environment/Compose verifier | 13/13 PASS | `node scripts/verify-p544.mjs` |
| Development sample environment preflight | PASS | `.env.example`, 0 issues |
| Runtime HTTP smoke | FAIL, 0/4 | API probes returned 404; web root unreachable on local defaults |
| TypeScript syntax scan | PASS | 263 files, 0 diagnostics |
| SQL migration static validation | PASS | 242 files; static-only |
| Docker Compose build/start | NOT RUN | Docker CLI unavailable |
| npm clean install/build/semantic typecheck | NOT RUN | Dependencies not installed in this workspace |
| PostgreSQL migration execution | NOT RUN | No verified PostgreSQL runtime available |

A failed local smoke run must not be interpreted as a passing runtime validation. Check API_BASE_URL/WEB_BASE_URL and ensure the intended P544 app is deployed before rerunning. The API 404 responses suggest the default API endpoint is not serving the expected route set, but the process identity was not established.
