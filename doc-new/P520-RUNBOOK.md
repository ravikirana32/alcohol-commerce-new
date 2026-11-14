# P520 Runbook — Payment Reconciliation Preview

## Prerequisites

- Start from the P520 cumulative source and configure the existing API environment.
- Apply database migrations using the project's normal migration command after reviewing them against a backup.
- Ensure the user has `payments:reconcile` permission and the outlet belongs to the active organisation.
- Keep `PAYMENT_LIVE_MODE=false` until provider integration, legal/compliance review and sandbox testing are complete.

## Import a statement (JSON API)

`POST /api/v1/payments/reconciliation/import`

Example body:

```json
{
  "outletId": "<outlet-uuid>",
  "provider": "UPI_PROVIDER",
  "statementReference": "SETTLEMENT-2026-11-09-001",
  "periodStart": "2026-11-08",
  "periodEnd": "2026-11-09",
  "lines": [
    {
      "providerTransactionId": "PROVIDER-TXN-001",
      "transactionReference": "UPI-REF-001",
      "method": "UPI",
      "amount": 1250.00,
      "transactionAt": "2026-11-09T08:30:00.000Z"
    }
  ]
}
```

## Run matching

`POST /api/v1/payments/reconciliation/<batch-uuid>/match`

The API returns matched, unmatched and exception counts. It only marks the batch `RECONCILED` when all imported lines match uniquely and no duplicate/mismatch exceptions remain.

## Inspect batch

`GET /api/v1/payments/reconciliation/<batch-uuid>`

Review each line before operational sign-off. Unmatched, duplicate or mismatch lines require investigation; do not assume they are settled.

## Safety

- Never enable live payments solely because reconciliation endpoints are available.
- Validate provider signature verification, idempotency, settlement fees, refunds, chargebacks and payout bank matching before connecting a real provider.
- Test with a non-production organisation and sandbox statements first.
