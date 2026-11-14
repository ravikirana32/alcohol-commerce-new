# P503 — Peg quarantine disposition and release verification

Version: `0.503.0-dev`  
Status: developer preview; not production certified.

## Delivered

- Added organisation-scoped `GET /api/v1/bar/peg-quarantine` queue for returned peg liquid.
- Added manager-authorised `POST /api/v1/bar/peg-quarantine/:restorationId/disposition`.
- Supported dispositions: `DISPOSED` and `RELEASED_BY_COMPLIANCE`.
- Compliance release requires a documented approval reference.
- Disposition records retain reason, actor, timestamp and compliance reference.
- Database trigger prevents edits to finalized disposition rows, source evidence mutation and ledger deletion.
- Audit event records volume and explicitly records `saleableStockChanged=false`.
- Added a manager quarantine queue to Bar Tickets & Refunds UI with refresh and disposition actions.
- Added migration `215_p503_peg_quarantine_disposition.sql`.
- Added unit tests for decision validation and deterministic static release checks.

## Safety model

Neither disposition action adds returned/served liquid to an open bottle or saleable stock. `RELEASED_BY_COMPLIANCE` records a compliance-authorised disposition only; any physical handling remains subject to the approved outlet SOP and applicable law. Do not interpret this status as permission to resell returned liquid.

## API permissions

- Queue: `bar:read`.
- Disposition: `bar:quarantine:manage`, seeded for `RETAIL_OWNER`, `RETAIL_MANAGER` and `BAR_OWNER`.

## Database change

Migration adds `disposition_reason`, `compliance_reference`, `disposition_by` and `disposition_at` to `bar_refund_peg_restorations`. Existing quarantine records remain pending until an authorised manager records a disposition.

## Verification

Run `npm run verify:p503`. It executes P503, P502 and inherited P501 deterministic checks. Also run `npm run typecheck`, `npm run build`, `npm test`, and a PostgreSQL clean-install plus P501-to-P503 upgrade against a disposable test database. Those dependency/database-backed checks are not represented as passed by the static verifier.
