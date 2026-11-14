# P517 — Bar and Restaurant POS End-to-End

**Version:** `0.517.0-dev`  
**Baseline:** P512 + P513 + P514 + P515 + P516  
**Status:** PARTIAL — static acceptance passed; live PostgreSQL/API/browser verification remains outstanding.

## Delivered in P517

### Table sessions
- Open an outlet-scoped table session with table label and guest count.
- Enforce one open session per table label within an organisation/outlet.
- Associate bar tickets with an open table session.
- Transfer a session to a different table label and update linked ticket labels.
- Merge two open sessions in the same outlet; move ticket and KOT associations to the target and combine guest counts.
- Close a table only after all its preparation tickets are served or cancelled.
- Record audit events for open, transfer, merge and close operations.

### KOT / preparation workflow
- Every successful bar checkout atomically creates a KOT header and KOT line records.
- KOTs include ticket/table references and product/quantity details.
- State transitions are enforced:
  - `NEW -> ACCEPTED -> PREPARING -> READY -> SERVED`
  - `NEW`, `ACCEPTED` or `PREPARING` may transition to `CANCELLED`.
- Every state transition is audited with actor and from/to status.
- KOTs are outlet and organisation scoped.

### POS integration
- Bar POS can select an open table session.
- Checkout request carries `tableSessionId`; the API verifies it is open and belongs to the same organisation/outlet.
- Table session identity is included in the checkout idempotency fingerprint.
- Existing walk-in checkout remains supported.
- POS refreshes table sessions after successful checkout.

### User interface
- New `Tables & KOT` navigation workspace.
- Open table form, active table list, transfer/merge/close actions.
- KOT queue with product lines and lifecycle actions.
- Existing bar ticket/refund and peg quarantine workspace remains intact.

## API routes introduced

- `GET /api/v1/bar/table-sessions?outletId=...`
- `POST /api/v1/bar/table-sessions`
- `POST /api/v1/bar/table-sessions/:sessionId/transfer`
- `POST /api/v1/bar/table-sessions/:sessionId/merge`
- `POST /api/v1/bar/table-sessions/:sessionId/close`
- `GET /api/v1/bar/kot?outletId=...`
- `POST /api/v1/bar/kot/:kotId/status`

The existing `POST /api/v1/bar/checkout` accepts optional `tableSessionId` and creates KOT records in the same database transaction as the paid ticket, ticket lines, stock/peg consumption, payments and audit record.

## Migration

`apps/api/src/db/219_p517_bar_tables_kot.sql`

Creates table-session, KOT header and KOT line tables; adds `bar_tickets.table_session_id`; adds scoped indexes and the one-open-session-per-table uniqueness constraint.

## Known limitations

- Current checkout model records paid bar tickets immediately. P517 does not introduce unpaid tabs, running bills, order editing after checkout, or deferred settlement.
- Split/merge of payment tenders and partial bill settlement are not implemented in this phase.
- KOT workflow is a database-backed queue and browser UI; it is not yet integrated with a physical kitchen display, printer or beverage-order terminal.
- KOT instructions/modifiers are not yet part of the POS cart schema.
- Live payment-provider capture remains disabled.
- Table transfer/merge and KOT lifecycle require real multi-user concurrency testing.
- Regulatory and licence controls remain subject to local excise/legal review.

## Acceptance evidence (2026-11-09)

- P517 static acceptance: PASS (15/15).
- TypeScript syntax transpilation: PASS (224 files, zero diagnostics).
- SQL migration static validation: PASS (218 ordered SQL files).
- P513, P514, P515 and P516 cumulative static verifiers: PASS.
- PostgreSQL migration execution: NOT RUN.
- API typecheck/build: BLOCKED by missing Node type dependencies in the environment.
- Web typecheck/build: BLOCKED by missing React/JSX type dependencies in the environment.
- Vitest and Playwright runtime tests: NOT RUN.
- Authenticated multi-user table/KOT end-to-end tests: NOT RUN.

P517 is developer preview only and is not production-approved.
