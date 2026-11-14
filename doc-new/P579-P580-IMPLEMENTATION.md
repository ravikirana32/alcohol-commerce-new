# P579–P580 Implementation Report

## P579 — Regulatory reporting and product-lot traceability
- Added migration `255_p579_regulatory_traceability.sql`.
- Added `regulatoryReportsRouter` and mounted it under `/api/v1`.
- Endpoints: `GET /compliance/reports`, `GET /compliance/reports/history`, `POST /compliance/traceability`, `GET /compliance/traceability`.
- Report runs are stored with a SHA-256 hash and immutable report data. Report types: excise decisions, licence status, dry-day orders and denied compliance decisions.
- Lot links are constrained to the same organisation, outlet, product and stock movement.
- Added permission codes for compliance report reading and traceability management.

## P580 — Device operations and offline sync controls
- Added migration `256_p580_pos_device_offline_health.sql`.
- Added `deviceOperationsRouter` and mounted it under `/api/v1`.
- Endpoints: `POST /devices/:deviceId/health`, `GET /devices/health`, `GET /offline/checkpoints`.
- Health evidence requires an organisation-owned device in TRUSTED state and an organisation-owned outlet.
- Offline sync intake now updates a durable, monotonic maximum-seen sequence checkpoint in the same transaction as batch/event intake. Composite foreign keys bind checkpoint device, organisation, outlet and batch.
- Existing review-only offline intake is preserved; this phase does not enable posting.

## Safety and limitations
No statutory rule values were fabricated. No live payment capture, provider dispatch, or offline alcohol posting was enabled. See `P513-P580-Cumulative-Gap-Register.md` for all remaining gaps and acceptance gates.
