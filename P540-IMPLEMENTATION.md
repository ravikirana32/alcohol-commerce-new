# P540 — Enterprise Integration Foundation

**Release:** 0.540.0-dev  
**Baseline:** P539 cumulative 0.539.0-dev  
**Delivery status:** Backend foundation developer preview; production acceptance not established.

## Delivered

- Migration 241 adds organisation-scoped enterprise integration registry with provider allowlist, HTTPS endpoint constraint, non-secret environment-variable credential reference and JSON configuration.
- Durable outbound event outbox with tenant/integration/idempotency uniqueness, retry scheduling metadata and explicit lifecycle states.
- Delivery attempt evidence table with outcome, HTTP status, response fingerprint and error code.
- Authenticated, organisation-scoped and permission-gated API to list/create/configure/pause/revoke integrations and inspect event history.
- Revoking an integration cancels queued/held/failed events; pausing holds queued events.
- No credential values are stored in the database. Only an environment-variable reference is stored.
- Outbound dispatch is intentionally disabled. No arbitrary URL fetch or network delivery is performed by this phase.
- API/web/root package version synchronized to 0.540.0-dev.

## API

- `GET /api/v1/enterprise-integrations`
- `POST /api/v1/enterprise-integrations`
- `POST /api/v1/enterprise-integrations/:integrationId/configure`
- `POST /api/v1/enterprise-integrations/:integrationId/status` (`PAUSED` or `REVOKED`)
- `GET /api/v1/enterprise-integrations/:integrationId/events`

Permissions: `integration:read`, `integration:manage`; organisation scope enforced on every route.

## Explicit limitations

- Provider-specific adapters (accounting/ERP/delivery/CRM/warehouse) are not implemented.
- No outbound dispatcher, retry worker, OAuth flow, webhook callback, mapping UI or provider certification is included.
- HTTPS scheme validation alone is not sufficient SSRF protection. Before enabling dispatch, implement DNS/IP egress allowlisting, redirect restrictions, TLS validation, timeouts, request signing, secret rotation and audit controls.
- Credential references must be provisioned in deployment secret management; this phase does not validate external secret availability.
- Existing P534–P539 legal, finance, security, runtime and UAT gaps remain open.
