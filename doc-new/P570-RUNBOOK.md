# P570 Runbook

1. Start the development stack using the existing root runbook: `docker compose up -d --build`.
2. Apply migrations with `npm run db:migrate` from the repository root (or the existing API workspace migration command).
3. Authenticate as a role with `inventory:read` and submit:

```bash
curl -X POST "$ACP_API/api/v1/inventory/reconciliation-runs" \
  -H "Authorization: Bearer $ACP_TOKEN" -H 'Content-Type: application/json' \
  -d '{"outletId":"<OUTLET_UUID>","notes":"Nightly stock review"}'
```

4. Review `GET /api/v1/inventory/reconciliation-runs?outletId=<OUTLET_UUID>` and `GET /api/v1/inventory/reconciliation-exceptions?outletId=<OUTLET_UUID>&status=OPEN`.
5. Investigate exceptions. A user with `inventory:adjust` may change the exception workflow status by POSTing `{ "status": "INVESTIGATING" | "RESOLVED" | "ACCEPTED", "notes": "..." }` to `/api/v1/inventory/reconciliation-exceptions/:exceptionId/status`.
6. Do not treat `RESOLVED` or `ACCEPTED` as a stock correction. Correct stock only through the approved stock adjustment flow, with a stable `Idempotency-Key`.

## Interpretation cautions

- `ADJUSTMENT` movement signs are not available in the legacy schema and are reported as unclassified.
- Pre-ledger opening balances are not inferred; reconcile against a verified opening snapshot before treating variances as definitive.
- No automatic stock correction is performed.
