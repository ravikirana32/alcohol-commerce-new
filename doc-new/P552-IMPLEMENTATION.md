# P552 — Backend API Permission Parity & Security Testing

**Version:** 0.552.0-dev  
**Baseline:** P551 cumulative source  
**Status:** Developer preview; static authorization inventory completed, runtime security acceptance pending.

## Delivered

1. Added `scripts/generate-p552-permission-matrix.mjs`. It scans ordered SQL migrations for both literal `(role_code, permission_code)` inserts and `INSERT ... SELECT role_code, 'permission' FROM (VALUES ...)` grants.
2. Regenerated `apps/api/src/authz/permission-matrix.generated.json`. The generated catalogue now contains 13 roles and 100 permission codes. This closes a real extraction defect: `bar:quarantine:manage` from migration `215_p503_peg_quarantine_disposition.sql` was previously omitted from the static matrix despite being granted to RETAIL_OWNER, RETAIL_MANAGER and BAR_OWNER.
3. Added `scripts/verify-p552-api-permission-parity.mjs` and `../reports/P552-API-ROUTE-PERMISSION-MATRIX.json`.
4. Scanned 227 API route declarations: 216 have direct or inherited `requirePermission` enforcement; 11 have explicit exemptions (health probes, static metadata, credential exchange, provider webhook signature, invitation-token acceptance, or authenticated self-context/profile/logout).
5. The audit found zero unclassified routes and zero backend or frontend action permission codes missing from the migration-derived catalogue.
6. Updated the P549 verifier to accept and validate the expanded migration-source description.
7. Added `npm run generate:p552:permissions` and `npm run verify:p552`.

## Security interpretation

This is a static source audit. An endpoint with inherited router-level permission middleware is counted as guarded. Explicitly exempt routes are documented with reasons and must still retain their own authentication, token, signature, rate-limit or public-metadata controls as applicable. This report does not prove middleware execution, database grant state, row-level ownership, outlet scoping or absence of IDOR vulnerabilities.

## Known finding resolved

The P549 generated permission matrix used a parser that only recognised literal role/permission tuples. It missed SQL grants expressed as `SELECT role_code, 'permission' FROM (VALUES ('ROLE'), ...)`. P552 adds support for that migration pattern and includes the missing `bar:quarantine:manage` grant in the generated role matrix.

## Still open

- PostgreSQL live role grant comparison and clean-install/upgrade execution.
- Runtime positive/negative API tests for all 13 seeded roles.
- Cross-organisation, cross-outlet and resource ownership/IDOR tests.
- End-to-end frontend action to backend route parity, including every mutation and resource-specific scope.
- Vitest, browser and full semantic build execution in an installed dependency environment.
- Production release gates from P513–P551 remain open.
