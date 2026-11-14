# P47 — Build & compilation fixes

## Objective
Resolve package, TypeScript, Vite, Node and Docker build failures and pin compatible dependencies.

## Delivered in this package
- Cumulative source baseline from P00 through P47.
- Phase migration `047_p47_build_compilation_fixes.sql`.
- Phase implementation contract, acceptance criteria, release notes and runbook references.

## Implementation detail
Build diagnostics, scripts and remediation checklist.

The migration establishes persistence foundations only. It does not itself complete the business workflow, UI, provider connection or legal obligations. Add tenant/outlet scoping, permission enforcement, validation, audit events, transaction boundaries and automated tests before exposing write APIs.

## Acceptance checklist
- [ ] Run migration on a clean database and a P45-upgraded staging database.
- [ ] Validate schema constraints, indexes, FK relationships where added by later implementation, and rollback/forward-fix plan.
- [ ] Implement authenticated, tenant-scoped API handlers with Zod validation and parameterised queries.
- [ ] Implement the relevant responsive UI with loading, empty, error and permission states.
- [ ] Add unit, API, integration, tenant-isolation and Playwright tests.
- [ ] Verify concurrency, idempotency, audit trail and operational recovery.
- [ ] Obtain provider sandbox sign-off and legal review where applicable.

## Status
Developer-preview foundation. Runtime completion and acceptance remain pending.
