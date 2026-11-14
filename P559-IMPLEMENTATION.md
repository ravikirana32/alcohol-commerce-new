# P559 Implementation — SQL Tenant Predicate Audit

- Version: `0.559.0-dev`
- Baseline: P558 cumulative package.
- Added a repeatable static scanner for SQL template literals passed directly to `.query()` across `apps/api/src`.
- Captures source file, line, operation, referenced tables, explicit `organisation_id` predicates, `outlet_id` predicates, and manual-review candidates.
- Added JSON and Markdown audit outputs, verifier, and npm commands.
- No production query, schema, permission grant, or tenant enforcement behavior was changed: static findings alone are not enough to safely rewrite business SQL.

## Findings

The scanner inspected 382 direct SQL template literals across 228 TypeScript files. It identified 252 statements requiring manual review because the SQL text did not contain a recognizable explicit organisation or outlet predicate. This is a deliberately conservative review queue, not a finding that 252 queries are vulnerable. Some queries are global metadata, use joins/CTEs, rely on already-scoped parent records, or construct SQL outside the scanner's supported pattern.

## Required follow-up

Review every candidate in context; add explicit predicates or document an approved global/parent-scoped exception; then add integration tests against disposable PostgreSQL fixtures. Do not use the report as a substitute for row-level security or runtime IDOR tests.
