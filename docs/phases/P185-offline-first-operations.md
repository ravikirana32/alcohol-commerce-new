# P185 — Offline-first operations

## Objective
Deliver safe offline billing and reliable synchronisation for approved POS devices.

## Deliverables
- [ ] Define local data cache and encrypted offline transaction queue
- [ ] Implement idempotent sync, conflict detection and recovery
- [ ] Protect stock-sensitive operations against overselling and stale balances
- [ ] Add device revocation, sync monitoring and offline recovery tests

## Acceptance evidence required
- Executed unit, integration and relevant end-to-end tests.
- Demonstrated working UI/API workflow using a non-production environment.
- Database migration tested on a clean database and supported upgrade path.
- Tenant isolation, permissions, audit and failure paths reviewed.
- Operational owner sign-off and recorded unresolved risks.

## Safety and release constraints
- Keep offline mode disabled until conflict and security tests pass

## Status
**Phase scope defined. Implementation completion and acceptance are not claimed by this phase document.**
