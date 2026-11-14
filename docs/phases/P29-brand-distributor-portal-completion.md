# P29 — Brand & distributor portal completion

## Objective
Brand/distributor onboarding, verification, campaigns, fulfilment, partner views and scoped reporting.

## Delivered in this phase package
Verification reviews, campaign fulfilment, distributor shipment and partner activity records.

- Cumulative source package from P00 through P29.
- Phase capability registry entry and API discovery endpoint.
- Phase-specific implementation contract, acceptance checklist and release note.
- Database migration added under `apps/api/src/db/`.

## API / UI contract
The feature must be exposed only through authenticated, tenant-scoped endpoints and role-appropriate UI routes. Validate all input with Zod, use parameterised SQL, record actor/outlet context, and make write operations idempotent where clients may retry. Do not expose provider credentials to the browser.

## Acceptance checklist
- [ ] API handlers enforce authentication, organisation and outlet scope, and fine-grained permissions.
- [ ] Validate request and response schemas; reject unknown or invalid values.
- [ ] Add unit, API integration, tenant-isolation and permission-negative tests.
- [ ] Add an operator workflow in the web workspace and an accessible loading/empty/error state.
- [ ] Verify transaction boundaries, audit events, duplicate request handling and rollback behaviour.
- [ ] Run migrations on a clean database and an upgraded P20 database.
- [ ] Verify backup/restore and operational monitoring before production use.

## Known limitations
This phase package is a developer implementation increment, not a declaration that every workflow is production complete. Third-party provider credentials, live sandbox tests, state-specific legal validation, real device testing and operational sign-off are not fabricated.
