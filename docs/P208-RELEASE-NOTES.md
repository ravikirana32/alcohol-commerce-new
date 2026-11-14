# P208 — Retail checkout concurrency integrity

## Scope
Prevent retail checkout overselling when stock rows are concurrently sold or the same product appears more than once in a cart.

## Delivered
- Locks the outlet/product stock balance row with `FOR UPDATE`.
- Tracks earlier same-request reservations before validating repeated product lines.
- Scopes idempotent replay lookup by organisation and outlet.

## Validation evidence
- Source inspection confirms stock row lock and reservation guard.
- TypeScript syntax transpilation passed for the final source snapshot.

## Limitations
No live concurrent PostgreSQL stress test was run. Cart-level idempotency payload equivalence and full API integration tests remain to be completed.

**Release classification:** developer preview only. Do not use for live alcohol transactions until the release gates in `docs/SECURITY-AND-RELEASE-GATES.md` are completed.
