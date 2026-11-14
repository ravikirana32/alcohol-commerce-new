# P532 — Offline Exception & Recovery Engine

**Release:** `0.532.0-dev`  
**Status:** PARTIAL / developer preview  
**Baseline:** P531 cumulative

## Scope delivered

- Durable organisation/outlet-scoped recovery cases linked to immutable offline posting executions, intents and source events.
- Append-only recovery action log and offline sync audit events.
- Automatic case creation when the P530/P531 posting engine records a terminal `BLOCKED` execution.
- Manual case opening for a posted execution requiring investigation.
- Triage workflow with evidence notes.
- Retry request for a triaged blocked execution. The original execution remains immutable; retry explicitly requires correcting the source and submitting a new source event.
- Cancellation of an unposted blocked/held intent. The intent is marked `CANCELLED`, the source event is rejected where eligible, and original execution evidence remains retained.
- Compensation request and independent maker-checker decision for posted transaction review cases.
- Compensation approval is only a handoff marker for P536. No inventory, payment, sale, refund or journal mutation occurs in P532.
- Operator recovery workspace embedded in Offline Reconciliation.
- Permission gates: `offline:recovery-read`, `offline:recovery-manage`, `offline:recovery-compensate`.

## API

- `GET /api/v1/offline/recovery/cases`
- `POST /api/v1/offline/recovery/executions/:executionId/case`
- `POST /api/v1/offline/recovery/cases/:caseId/triage`
- `POST /api/v1/offline/recovery/cases/:caseId/retry-request`
- `POST /api/v1/offline/recovery/cases/:caseId/cancel`
- `POST /api/v1/offline/recovery/cases/:caseId/compensation-request`
- `POST /api/v1/offline/recovery/cases/:caseId/compensation-decision`

## Safety invariants

1. Every case and query is scoped by authenticated organisation.
2. Recovery decisions lock the case row and validate its current state inside a database transaction.
3. Retry never replays a terminal execution; it requires a corrected new source event.
4. Cancellation is allowed only for blocked executions whose intent is still held/authorised and unposted.
5. Compensation request is only for a posted execution. The approver must differ from the requester.
6. Compensation approval does not execute a reversal; P536 must implement balanced accounting and P535 settlement/refund integration before any financial compensation can occur.
7. Recovery actions are append-only. Original posting executions are retained.

## Explicit limitations

- Live PostgreSQL/API/browser execution was not available in this workspace.
- No runtime claim is made for row-lock behaviour, transaction rollback, IDOR resistance or concurrent requests until integration tests run against PostgreSQL.
- Recovery actions do not yet implement provider refunds, stock return/reversal or journal compensation.
- Legal/excise/tax constraints remain subject to P533/P534 jurisdictional approval.
