# P560 — SQL Candidate Triage & Tenant-Safe Remediation Assessment

## Delivered
- Correlated P559 direct `.query()` candidates with SQL `CREATE TABLE` declarations.
- Generated `../reports/P560-SQL-TRIAGE.json` and `P560-SQL-TRIAGE.md` with file/line, operation, table, schema-column evidence and rationale.
- Added `scripts/audit-p560-sql-triage.mjs` and `scripts/verify-p560-static.mjs`.
- Added `audit:p560:sql`, `verify:p560:static`, and cumulative `verify:p560` npm scripts.
- Updated application version to `0.560.0-dev`.

## Triage result
- SQL migration files scanned: see P560-SQL-TRIAGE.json.
- P559 candidates included: 260 (252 without recognised predicates plus 8 outlet-only statements).
- Global/reference/auth allowlist: 1.
- Schema unresolved: 71.
- Tenant-bearing table review: 188.

## Remediation decision
No application SQL was changed. Static matching is insufficient to safely rewrite multi-table joins, inserts, CTEs, transaction workflows, or parent-owned child records. Changing these without tracing caller context and exercising real tenant fixtures could break valid flows or create a false sense of security. P560 therefore supplies a structured triage queue, not a claim that the 188 tenant-bearing candidates are confirmed vulnerabilities or remediated.
