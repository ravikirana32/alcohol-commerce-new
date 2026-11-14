# P561 — Tenant-Scope Remediation for Confirmed High-Risk SQL Paths

## Delivered
- Reviewed five high-risk update paths identified from P559/P560: bar KOT status, offline recovery triage, finance journal posting, retail sale refund status, and outlet shift closure.
- Added explicit `organisation_id` predicates to all five UPDATE statements.
- Added the organisation identifier as a bound parameter; no user-supplied SQL fragments were introduced.
- Added `scripts/verify-p561-tenant-updates.mjs` with five source assertions.
- Added `verify:p561:static` and cumulative `verify:p561` npm scripts.
- Updated application version to `0.561.0-dev`.

## Remediation details
| Path | Prior guard context | Remediation |
|---|---|---|
| Bar KOT status | Row selected `FOR UPDATE` by ID + organisation | UPDATE now repeats organisation predicate |
| Offline recovery triage | Case selected `FOR UPDATE` by ID + organisation | UPDATE now repeats organisation predicate |
| Finance journal posting | Journal inserted in same transaction with organisation | UPDATE now repeats organisation predicate |
| Retail sale refund status | Sale selected `FOR UPDATE` by ID + organisation | UPDATE now repeats organisation predicate |
| Outlet shift close | Shift selected `FOR UPDATE` by ID + organisation | UPDATE now repeats organisation predicate |

These were defence-in-depth changes: the preceding transaction-level selection already scoped the row. Repeating the tenant predicate makes the mutation independently constrained and protects against future refactors that weaken the earlier read.

## Verification
- P561 source assertions: 5/5 PASS.
- P560 and inherited P559–P552 static verification chain: PASS.
- TypeScript syntax transpilation: 272 files, 0 diagnostics.
- SQL migration static validation: 242 ordered SQL files PASS.

## Not run / limitations
- No PostgreSQL runtime or authenticated API execution was available in this phase.
- No Vitest/Playwright, cross-tenant live fixtures, load test or penetration test was run.
- The 188 tenant-bearing-table candidates and 71 schema-unresolved candidates from P560 remain review queues, not confirmed vulnerabilities.
- This phase changes five UPDATE predicates only; it does not certify all SQL statements, joins, background jobs, ORM queries or parent-child ownership paths.
- Production remains NO-GO.
