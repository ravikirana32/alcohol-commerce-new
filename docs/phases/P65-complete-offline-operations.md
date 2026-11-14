# P65 — Complete offline operations

## Objective
Offline billing, local persistence, sync recovery, conflict resolution and duplicate prevention.

## Delivered in this package
- Cumulative source baseline from P00 through P65.
- Phase migration `065_p65_complete_offline_operations.sql`.
- Phase implementation contract, acceptance criteria, release notes and runbook references.

## Implementation detail
Offline queue state, sync checkpoints and conflict review records.

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
