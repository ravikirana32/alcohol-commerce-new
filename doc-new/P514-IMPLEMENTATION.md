# P514 — Organisation, Outlet and Access Management

**Version:** `0.514.0-dev`  
**Baseline:** P513 cumulative source  
**Status:** PARTIAL — source and UI workflows implemented; database-backed and browser end-to-end verification are blocked by missing dependencies/runtime.

## Implemented in this phase

- Organisation profile read/update API and editable organisation profile UI.
- Outlet creation and listing through the existing tenant-scoped API, surfaced in the Organisation & Team workspace.
- Outlet licence submission and per-outlet licence listing UI using existing APIs. Licence review remains platform-admin-only; a licence does not authorise trading until it is verified and the outlet is active.
- Secure organisation invitation lifecycle: cryptographically random one-time token, SHA-256 token hash at rest, expiry, single-use state, transaction locking, role assignment and audit events.
- Invitation acceptance: creates an account or verifies the existing account password, activates the organisation membership and consumes the invitation atomically.
- Organisation member listing, role/status updates and suspension/reactivation/revocation endpoints.
- Outlet assignment management for team members; outlet assignments are constrained to outlets owned by the same organisation.
- Retail/bar operational access guard now requires non-owner staff to be explicitly assigned to the target outlet. Organisation owners retain organisation-wide access.
- Organisation audit event query endpoint.
- New Organisation & Team UI: profile, outlets, licence records, invitations, team membership and outlet assignments.
- P514 static acceptance verifier and migration `217_p514_organisation_access.sql`.

## API routes added

- `GET /api/v1/organisation/current`
- `PATCH /api/v1/organisation/current`
- `GET /api/v1/organisation/members`
- `POST /api/v1/organisation/invitations`
- `POST /api/v1/organisation/invitations/accept` (public token-acceptance route)
- `PATCH /api/v1/organisation/members/:userId`
- `PUT /api/v1/organisation/members/:userId/outlets`
- `GET /api/v1/organisation/audit-events`

Existing outlet and licence APIs remain in `operations.ts`.

## Important limitations

- Invitation tokens are returned once to the authorised caller for delivery. SMTP/email delivery integration is not implemented; do not expose the token in logs or public pages.
- Licence evidence is currently represented by an optional URI; secure document storage/upload and verification integrations are not implemented.
- The UI can submit licence details, but only a platform administrator can review/verify licences and activate outlets.
- Outlet assignment enforcement was wired into retail and bar checkout capability checks. Other outlet-scoped operations still require a systematic access-control pass in later integration hardening; do not assume every endpoint is fully outlet-assignment-aware yet.
- Role changes take effect on the next authenticated request because permissions are loaded from the database per request; existing JWT role claims are checked against current membership.
- Runtime tests, PostgreSQL migration execution and browser tests were not run because dependencies are unavailable and no verified PostgreSQL/API runtime is active.

## Acceptance status

Static acceptance checks pass. P514 remains **PARTIAL**, not complete, until clean migration execution, dependency-backed typecheck/build, invitation lifecycle API tests, cross-tenant denial tests, outlet-assignment tests and browser E2E all pass.
