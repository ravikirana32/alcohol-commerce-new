# P178 — Database and migration stabilisation

## Objective
Validate schema integrity, migration order, clean installs, upgrades and rollback strategy.

## Deliverables
- [ ] Review all cumulative SQL migrations and foreign-key dependencies
- [ ] Test clean database installation and supported upgrade paths
- [ ] Add constraints, indexes and transaction-safe migration practices
- [ ] Document backup, restore and migration rollback procedures

## Acceptance evidence required
- Executed unit, integration and relevant end-to-end tests.
- Demonstrated working UI/API workflow using a non-production environment.
- Database migration tested on a clean database and supported upgrade path.
- Tenant isolation, permissions, audit and failure paths reviewed.
- Operational owner sign-off and recorded unresolved risks.

## Safety and release constraints
- Do not apply unreviewed migrations to production data

## Status
**Phase scope defined. Implementation completion and acceptance are not claimed by this phase document.**
