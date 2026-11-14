# P152 — Full regression testing

## Objective
Establish repeatable unit, integration, API and browser regression coverage across the cumulative product.

## Deliverables
- [ ] Define test environments and deterministic seed data
- [ ] Cover auth, tenant isolation, retail checkout, peg deduction, bar tickets and shift close
- [ ] Add regression tests for previously fixed defects
- [ ] Publish test reports and known failures

## Acceptance evidence
- Executed automated tests and attached report.
- Relevant API/UI workflow demonstrated in a non-production environment.
- Database migration tested both on a clean database and as an upgrade.
- Security, tenant-scope and permission checks reviewed.
- Operational owner signs off; unresolved issues are documented.

## Risks and controls
- Test credentials and fixtures must not use production data
- Tests are not considered passed until executed in CI

## Delivery status
**Scope defined; implementation and acceptance are not claimed by this phase contract.**
