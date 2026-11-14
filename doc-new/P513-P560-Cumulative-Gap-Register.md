# Cumulative Gap Register — P513–P560

This register extends the P513–P559 cumulative register. All prior unresolved gaps remain open unless a phase report explicitly closes them.

## P560 — SQL Candidate Triage

**Status:** Static triage complete; live security acceptance open.

- 260 P559 candidates triaged: 1 global/reference/auth allowlist, 71 schema-unresolved, 188 tenant-bearing-table review.
- The 188 candidates are not confirmed vulnerabilities; each requires query-path, join, parent-ownership and runtime fixture review.
- No production SQL was modified.

### Open P560 actions
1. Trace candidate SQL through handlers, services, repositories, joins, transactions and background jobs.
2. Execute authenticated cross-organisation and cross-outlet denial tests using disposable PostgreSQL fixtures.
3. Verify nested child-resource ownership, exports and report scoping.
4. Run Playwright, penetration, backup/restore and production acceptance suites.

## Carried-forward production gates
- Live PostgreSQL migration and role-grant comparison.
- Authenticated API allow/deny matrix and cross-tenant/outlet IDOR tests.
- Full resource ownership review and SQL runtime verification.
- Tax/excise legal and finance approval; payment provider certification; accounting reconciliation.
- Hardware attestation, offline alcohol posting controls, integration egress/provider certification.
- Distributed rate limiting, complete audit coverage, backup/restore drills, load/failover and penetration tests.
- UAT, browser E2E and signed pilot/go-live acceptance.

**Release decision: NO-GO.**

## P561 — Tenant-scope remediation for selected high-risk updates

| ID | Finding / work item | Status |
|---|---|---|
| P561-01 | Bar KOT status mutation repeats organisation predicate | CLOSED — static source assertion |
| P561-02 | Offline recovery triage mutation repeats organisation predicate | CLOSED — static source assertion |
| P561-03 | Finance journal posting mutation repeats organisation predicate | CLOSED — static source assertion |
| P561-04 | Retail sale refund status mutation repeats organisation predicate | CLOSED — static source assertion |
| P561-05 | Outlet shift close mutation repeats organisation predicate | CLOSED — static source assertion |
| P561-06 | Runtime cross-organisation and cross-outlet tests for these paths | OPEN |
| P561-07 | Remaining P560 tenant-bearing-table review queue (188 candidates) | OPEN |
| P561-08 | Remaining P560 schema-unresolved review queue (71 candidates) | OPEN |
| P561-09 | Full SQL/ORM/background-job tenant ownership audit | OPEN |
| P561-10 | Independent penetration test and production security sign-off | OPEN |

P561 changes are defence-in-depth: each target row was already selected/created under organisation context in its transaction. The new predicates constrain the subsequent UPDATE independently. Static source assertions do not prove runtime DB isolation. Production remains NO-GO.
