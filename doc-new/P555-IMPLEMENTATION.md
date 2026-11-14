# P555 Implementation — Authenticated API Authorization E2E Harness

- Version: `0.555.0-dev`
- Baseline: P554 cumulative ZIP
- Added `scripts/run-p555-authenticated-api-matrix.mjs` to exercise real `/api/auth/login`, JWT bearer authentication, DB-backed session and membership reload, protected GET/HEAD route cases, permission-denied responses, logout and server-side session revocation.
- Added `docs/security/P555-AUTHENTICATED-API-MATRIX.md` with safe configuration and acceptance boundaries.
- Added `scripts/verify-p555-static.mjs` and npm commands `verify:p555:static`, `test:authorization:p555:live`, `verify:p555`.
- The live harness deliberately permits only GET/HEAD protected route cases; it does not issue destructive API requests. It does revoke the first disposable test session to prove logout invalidation.
- Credentials are supplied through environment variables and never written to reports. Login response bodies are suppressed on errors.
- No application runtime auth logic, migrations, grants or production configuration were changed.

## Scope limitation

This phase provides the harness; it does not claim live API success. A supplied case proves only that role/permission/path combination. Full route coverage, tenant/outlet IDOR, write-operation authorization, browser tests, penetration testing and sign-off remain open.
