# P525 Runbook

## Prerequisites

- PostgreSQL configured through `DATABASE_URL`.
- API dependencies installed with the repository's pinned package manager/lockfile.
- Authenticated user with an organisation and an appropriate role/permission.
- An active outlet belonging to that organisation.

## Apply migration

```bash
npm run db:migrate --workspace @acp/api
```

The new migration is `224_p525_offline_sync_ledger.sql`. Take a database backup first in shared environments. Review the migration status/checksum table after execution.

## Enrol a device

```http
POST /api/v1/offline/devices
Content-Type: application/json
Authorization: Bearer <token>

{"deviceId":"00000000-0000-4000-8000-000000000001","outletId":"<outlet-uuid>","label":"Front counter terminal"}
```

## Submit a sync batch

```http
POST /api/v1/offline/sync-batches
Content-Type: application/json
Authorization: Bearer <token>

{
  "batchId":"00000000-0000-4000-8000-000000000002",
  "deviceId":"00000000-0000-4000-8000-000000000001",
  "outletId":"<outlet-uuid>",
  "events":[{
    "eventId":"terminal-01-event-0001",
    "sequence":1,
    "type":"DEVICE_DIAGNOSTIC",
    "payload":{"connectivity":"ONLINE"}
  }]
}
```

Repeat the exact request to exercise batch replay. Reusing a batch ID with a different payload must return HTTP 409. Reusing an event ID or sequence in a different batch is classified as duplicate/conflict and is not inserted again.

## Operational cautions

- Do not treat HTTP 202 as a completed sale or payment.
- `RETAIL_SALE`, `BAR_CHECKOUT` and `STOCK_ADJUSTMENT` events are quarantined; no financial or inventory posting is performed.
- Do not enable `OFFLINE_SYNC_ENABLED` as a signal that offline sales are approved. Feature flag and legal authorisation are separate release gates.
- Revoke a lost device immediately; device attestation and cryptographic signing are not yet implemented.
- Check batches with `GET /api/v1/offline/sync-batches`; investigate conflicts before any manual downstream action.
- Never manually insert journal, stock or payment postings from unreviewed payloads.

## Verification commands

```bash
node scripts/verify-p525.mjs
node scripts/check-typescript-syntax.mjs
python3 scripts/verify-migrations.py
```

Live PostgreSQL migration, concurrent request, cross-tenant authorisation and API E2E tests remain mandatory before production use.
