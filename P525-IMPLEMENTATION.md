# P525 — Offline Sync Intake, Idempotency and Reconciliation Ledger

**Version:** 0.525.0-dev  
**Status:** PARTIAL / developer preview  
**Baseline:** P524 cumulative source

## Delivered

- Added migration `apps/api/src/db/224_p525_offline_sync_ledger.sql` for enrolled devices, sync batches, sync events and immutable-style audit records.
- Added organisation/outlet-scoped device enrolment and revocation endpoints.
- Added bounded batch intake (1–500 events; 1 MiB JSON event payload ceiling).
- Added SHA-256 payload hashes, batch-ID replay protection and per-device event-ID/sequence uniqueness.
- Added duplicate and conflicting event classification and audit events.
- Added sync batch summary listing for authorised users.
- All events are quarantined as `REVIEW_REQUIRED`; the API explicitly reports `financialPosting: DISABLED`.
- Mounted the router under `/api/v1` and added permissions for retail/bar owner and manager roles.

## API

- `POST /api/v1/offline/devices` — enrol a device for an outlet (`offline:manage`).
- `POST /api/v1/offline/devices/:deviceId/revoke` — revoke an enrolled device (`offline:manage`).
- `POST /api/v1/offline/sync-batches` — submit a batch (`offline:sync`).
- `GET /api/v1/offline/sync-batches` — list recent batches and review/conflict counts (`offline:read`).

## Safety and limitations

This is a durable intake ledger only. It does not post sales, payments, inventory movements, bar checkouts, accounting journals or tax records. It does not implement client acknowledgement cursors, cryptographic device attestation, signed event provenance, a maker-checker reconciliation UI, automatic retries, dead-letter handling or native background sync. Device UUID enrolment is not hardware attestation. The batch payload hash uses JSON serialization; canonical JSON and signature verification remain future work. The API route has not been exercised against a live PostgreSQL instance in this delivery.

## Verification

See `P525-STATUS.md` and `P525-RUNBOOK.md`. Static acceptance checks establish source presence and safety guards only; they do not prove SQL execution, transaction isolation, authorisation or runtime correctness.
