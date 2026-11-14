# P527 — Offline Event Validation and Posting Intents

Version: `0.527.0-dev`  
Status: **PARTIAL — developer preview**

## Implemented
- Migration `226_p527_offline_event_validation.sql` adds immutable validation evidence and idempotent posting-intent records.
- `POST /api/v1/offline/reconciliation/events/:eventId/validate` validates only independently approved events (`APPROVED_NO_POST`).
- Structural checks for retail sale, bar checkout, stock adjustment and device diagnostic payloads.
- Validation results and checks are recorded with validator identity and notes.
- Passing financial/stock events create one organisation-scoped posting intent and transition to `READY_FOR_POST`.
- Failed events transition to `VALIDATION_FAILED`; diagnostic events do not create posting intents.
- `GET /api/v1/offline/posting-intents` provides organisation-scoped intent visibility.
- Operator review UI adds validation notes, validate action and posting-intent list.
- Audit action `VALIDATION_RESULT` records validation outcomes.

## Safety boundaries
- `READY_FOR_POST` is not a posted sale or stock movement.
- No sales, payments, inventory, tender or accounting ledger is mutated in P527.
- Structural payload validation is not authoritative validation of current catalogue, price, tax, GST, licence, excise, age eligibility, stock or payment settlement.
- Validation evidence is immutable per event. Corrected payloads must be resubmitted as new, traceable events rather than editing an accepted offline event.

## Endpoints
- `POST /api/v1/offline/reconciliation/events/:eventId/validate`
- `GET /api/v1/offline/posting-intents?status=READY_FOR_POST|HELD|CANCELLED`

## Migration
- `apps/api/src/db/226_p527_offline_event_validation.sql`

## Remaining work
See `P513-ONWARD-GAP-REGISTER.md`, P527 section. Runtime PostgreSQL/API/browser/security tests have not been completed in this delivery.
