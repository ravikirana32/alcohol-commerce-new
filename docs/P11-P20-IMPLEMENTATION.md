# P11–P20 implementation notes

This document describes the source and schema delivered in the cumulative P11–P20 snapshots. Each phase adds one ordered migration under `apps/api/src/db/` and routes under `apps/api/src/routes/ecosystem.ts`.

## P11 — Multi-outlet management
- Outlet groups, outlet-specific price lists and inter-outlet transfer records.
- Transfer dispatch deducts source stock and appends a stock movement.
- Destination receipt records accepted quantities and credits destination stock.
- Transfer APIs require `outlet:transfer`.
- Remaining: full approval/dispatch/receipt state machine, partial shipment reconciliation, transfer cancellation/reversal, outlet-level RBAC, consolidated UI.

## P12 — Finance and accounting
- Expense records, supplier invoice metadata, ledger entry schema and accounting export jobs.
- Expense create and organisation finance summary APIs.
- Export requests are queued only; a worker and format-specific export implementation are not included.
- Remaining: double-entry posting engine, invoice matching, tax/GST rules, refunds, deposits, bank settlement and verified Tally connector.

## P13 — CRM and consent
- Customer profiles, consent history and loyalty account/ledger schema.
- Customer create/update and consent capture APIs.
- Consent is purpose-specific and versioned. Marketing communication must be suppressed when consent is absent or revoked.
- Remaining: retention/deletion workflow, customer data export, consent withdrawal UX, loyalty accrual/reversal and privacy assessment.

## P14 — Brand portal
- Brand profile, campaign, target outlet and asset metadata schemas.
- Brand campaign create/list APIs.
- Campaigns remain draft by default; approval, content moderation, brand-to-outlet legal controls and delivery workers remain.
- No alcohol advertising/promotion should be activated without jurisdiction-specific legal approval.

## P15 — Distributor portal
- Distributor profile, outlet assignment, order and order-line schemas.
- Distributor order create/list APIs.
- Remaining: distributor verification, territory constraints, quote acceptance, dispatch, invoice, delivery proof, settlement and purchase-order integration.

## P16 — Trade partner engagement
- Trade schemes, participant, points ledger and field visit schemas.
- Scheme create and representative visit/check-out APIs.
- Remaining: reward fulfilment, points approval, fraud detection, sales target calculation, learning content and mobile app UI.
- Incentives and trade promotions require legal review and must not be used to bypass restrictions on alcohol promotion.

## P17 — Consumer discovery (legal gate)
- Public listing metadata and review/audit schemas.
- Listing creation defaults to HIDDEN. Platform-admin review is required before publication.
- This phase intentionally does not provide online alcohol checkout, delivery ordering or consumer alcohol advertising.
- Before enabling discovery, obtain local legal review and document the jurisdiction, permitted content, age/eligibility restrictions and approval evidence.

## P18 — Analytics and reporting
- Report definition and report run queue.
- Sales summary by outlet and report request APIs.
- Remaining: asynchronous worker, materialised views, inventory valuation, peg yield, shift reconciliation, export generation, row-level access and dashboard UI.

## P19 — Offline sync and integrations
- Device registration, sync batch, integration connection and event schemas.
- Sync ingestion validates a payload hash and uses an outlet-scoped idempotency key.
- Remaining: device registration and secure device credentials, signed event envelopes, event processor, conflict resolution, replay protection, local IndexedDB queue, retry/backoff, encrypted local data and device revocation.
- Do not enable offline sync in production until conflict policies and transaction replay tests pass.

## P20 — Production operations and launch readiness
- Operational alerts, backup verification and release check schemas.
- Platform-admin APIs to record alerts and release-gate evidence.
- These records do not perform monitoring, backups or deployments by themselves. Connect actual infrastructure tooling and retain evidence.
- Remaining: production CI/CD, secret manager, metrics/logging/tracing, alert delivery, backup automation, restore drills, security assessment, load test, disaster recovery, support runbooks and pilot sign-off.

## API endpoints introduced
- P11: `POST /api/v1/outlet-transfers`, `POST /api/v1/outlet-transfers/:transferId/receive`
- P12: `POST /api/v1/finance/expenses`, `GET /api/v1/finance/summary`, `POST /api/v1/finance/exports`
- P13: `POST /api/v1/crm/customers`, `POST /api/v1/crm/customers/:customerId/consents`
- P14: `POST/GET /api/v1/brands/campaigns`, `POST /api/v1/brands/campaigns/:campaignId/review` (platform admin)
- P15: `POST /api/v1/platform/distributor-assignments`, `POST/GET /api/v1/distributor/orders`
- P16: `POST /api/v1/trade/schemes`, `POST /api/v1/trade/schemes/:schemeId/enrol`, `POST /api/v1/trade/visits`, `POST /api/v1/trade/visits/:visitId/checkout`
- P17: `POST /api/v1/platform/consumer-discovery/:organisationId/enable`, `POST /api/v1/consumer/listings`, `POST /api/v1/consumer/listings/:listingId/review`
- P18: `POST /api/v1/analytics/reports`, `GET /api/v1/analytics/sales-summary`
- P19: `POST /api/v1/sync/devices`, `POST /api/v1/sync/batches`
- P20: `POST /api/v1/platform/ops/alerts`, `POST /api/v1/platform/ops/release-checks`

## Common requirements
- Bearer authentication and permission checks apply to all ecosystem routes.
- Organisation identity is derived from the authenticated principal.
- Use only the matching phase and earlier endpoints with a snapshot; later endpoints share the route source but their tables are not migrated yet.
- Apply migrations to a disposable database first. Do not skip migration order.
