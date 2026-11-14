# P520 — Payments, Refunds and Reconciliation

Version: `0.520.0-dev`  
Status: `PARTIAL — developer preview`

## Implemented in this phase

- Added organisation/outlet-scoped payment reconciliation batches and statement lines.
- Added statement import API: `POST /api/v1/payments/reconciliation/import`.
- Added deterministic matching API: `POST /api/v1/payments/reconciliation/:batchId/match`.
- Added batch detail API: `GET /api/v1/payments/reconciliation/:batchId`.
- Matching checks captured retail and bar payments using organisation, outlet, provider reference, tender method and exact amount (0.005 tolerance).
- Duplicate provider transaction IDs across batches for the same provider are flagged as `DUPLICATE`.
- Ambiguous payment matches are marked `MISMATCH`; no arbitrary payment is selected.
- Batch transitions to `RECONCILED` only when all lines are matched and no duplicate/mismatch exceptions remain.
- Existing retail/bar refund APIs and cash/shift reconciliation remain in the cumulative baseline; P520 does not replace them.

## Migration

`apps/api/src/db/222_p520_payment_reconciliation.sql`

## Required permissions

`payments:reconcile` is seeded for retail/bar owner and manager roles. The APIs require authentication, organisation scope and permission checks.

## Known limitations

- No payment gateway capture/void/refund adapter has been activated. Live payments remain disabled by default.
- No settlement statement file parser (CSV/XLSX/UPI provider-specific formats) or upload UI is included; import is currently JSON API only.
- Matching currently uses provider transaction reference, tender method and amount. It does not model MDR/fees, net settlement, chargebacks, reversals, split settlement, or payout-to-bank matching.
- `CLOSED` batch transition and manual exception resolution are not yet implemented.
- Reconciliation is a recorded match against existing captured payments; it does not initiate transfers or provider API calls.
- Existing checkout still captures/records payments according to its current POS workflow; deferred tabs and payment collection lifecycle remain incomplete.
- Refund routes in the baseline create refund records and inventory dispositions, but no live gateway refund is issued.

## Verification evidence

- `node scripts/verify-p520.mjs`: 12/12 static checks passed.
- `node scripts/check-typescript-syntax.mjs`: 227 files, zero syntax diagnostics.
- `python3 scripts/verify-migrations.py`: 221 ordered migration files passed static validation.
- P517, P518 and P519 static verifiers passed.
- PostgreSQL execution, API integration, provider sandbox and browser E2E tests were not run. This phase is not production approved.
