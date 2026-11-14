# P541 — Security, Performance & Reliability Hardening

**Release:** 0.541.0-dev  
**Baseline:** P540 cumulative 0.540.0-dev  
**Delivery:** Developer-preview implementation; production acceptance not established.

## Implemented

- Migration 242 adds organisation-scoped append-only security audit events, indexed by organisation/time, actor/time and event/time.
- Database trigger rejects UPDATE/DELETE on security audit evidence.
- Recovery evidence registry records backup-created, restore-verified and drill-failed evidence with optional SHA-256 checksum.
- Authenticated, organisation-scoped `GET /api/v1/security/audit-events` endpoint with `security:audit:read`, bounded page size and timestamp cursor.
- Enterprise integration create/configure/pause/revoke actions now append audit evidence with actor, organisation, request ID, source IP and non-secret metadata.
- Process-local rate limiting for login, refresh, forgot-password and reset-password endpoints; returns HTTP 429 and rate-limit headers.
- Version synchronized to `0.541.0-dev`.

## Important limitations

- The rate limiter is process-local, not distributed. Production multi-instance deployments must enforce a shared gateway/Redis limiter and configure proxy trust safely.
- Rate limiting is a baseline safeguard, not bot detection, MFA, credential-stuffing defence or account lockout policy.
- Recovery evidence is a registry only. It does not create backups, restore databases or prove RPO/RTO. Actual restore drills and independently retained evidence are required.
- Audit coverage is currently focused on enterprise integration management. It is not yet a complete audit trail for every financial, licensing, inventory, user-admin and offline action.
- Audit event insertions are separate statements after integration state changes; atomic transaction coupling remains open for a future hardening task.
- No load, penetration, PostgreSQL, API integration, browser, backup/restore or multi-instance runtime tests were run in this environment.
