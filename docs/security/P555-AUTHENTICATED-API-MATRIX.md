# P555 — Authenticated API authorization matrix

This harness exercises the deployed API's real `/api/auth/login`, bearer JWT validation, database session lookup, database-derived organisation membership/role permissions, protected routes, logout and revoked-session rejection. It does not inject `req.auth`.

## Required environment

- `API_BASE_URL`: base URL of a disposable test deployment, e.g. `http://127.0.0.1:8080`.
- `P555_ROLE_CREDENTIALS_JSON`: JSON object keyed by exact role code. Each value has `email`, `password`, and optional `organisationId`. Use disposable seeded accounts only; do not commit credentials.
- `P555_API_CASES_JSON`: JSON array of read-only route cases. Each item: `role`, `permission`, `path`, `method` (`GET` or `HEAD` only), `expectedStatus` (200 for granted, 403 for denied). Include at least one granted and one denied case per role that is in scope. Route must actually enforce the named permission.

Example shape (replace placeholders with real test values and actual protected routes):

```json
{"RETAIL_OWNER":{"email":"retail.owner@demo.acp.local","password":"<disposable-secret>","organisationId":"<test-org-uuid>"}}
```

```json
[{"role":"RETAIL_OWNER","permission":"catalogue:product:read","path":"/api/catalogue/products","method":"GET","expectedStatus":200},{"role":"CASHIER","permission":"catalogue:product:write","path":"/api/catalogue/products","method":"GET","expectedStatus":403}]
```

Run `npm run test:authorization:p555:live`. The harness is deliberately read-only for route cases and then revokes the first test session to verify server-side invalidation. Use a disposable environment because it logs out that first role session. It suppresses credential values and response bodies. Never point this at production.

## Acceptance boundary

A passing run proves only the supplied route/role cases against the tested deployment. It does not establish full route coverage, tenant/outlet IDOR resistance, write-operation safety, production penetration-test acceptance, or legal/finance sign-off. Add cross-organisation and outlet scope fixtures in P556; do not infer tenant isolation from permission checks alone.
