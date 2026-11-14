# P553 Tenant, Outlet and Resource Isolation Test Plan

## Purpose
Validate that authenticated users cannot read or mutate another organisation's, outlet's, or resource's data by changing identifiers in requests. This plan is intentionally separate from the P552 static route permission scan.

## Required disposable test environment
- PostgreSQL database created solely for automated testing; never point destructive fixture setup at production.
- Two organisations (ORG_A, ORG_B), two outlets per organisation (A1, A2, B1), and distinct users for owner, manager, cashier, auditor and platform administrator roles.
- Each fixture resource must carry an organisation identifier and, where relevant, outlet identifier. Use generated UUIDs and retain a fixture manifest for the test run.
- Seed roles from the migration-derived role_permissions table. Do not hard-code passwords; inject disposable credentials through environment variables.

## Test matrix
| Actor | Resource scope | Expected result |
|---|---|---|
| ORG_A owner | ORG_A / A1 | Allow only if role permission and outlet scope both match |
| ORG_A owner | ORG_A / A2 | Allow only for organisation-wide grants or explicit A2 access |
| ORG_A user | ORG_B / B1 | Deny; no data leakage in response body |
| A1-only cashier | ORG_A / A2 | Deny for outlet-restricted operations |
| ORG_A auditor | ORG_A financial mutation | Deny; read-only role remains read-only |
| Unauthenticated caller | Any protected resource | 401 |
| Authenticated caller without permission | Protected action | 403 |
| Revoked/suspended membership | Previously accessible resource | Deny after revocation is effective |

## Required request cases
1. List endpoints: tenant filter applied before pagination and counts.
2. Detail endpoints: foreign UUID returns consistent 404/403 policy without exposing existence-sensitive fields.
3. Mutations: create/update/delete must derive organisation scope from authenticated context, not trust body/query organisation IDs.
4. Nested resources: verify parent-child ownership (order-line, invoice, payment, stock movement, GRN, settlement, journal, device, integration attempt).
5. Bulk/export/report endpoints: tenant and outlet filters apply to every row and aggregate.
6. Async jobs/outbox/webhooks: persisted tenant identity is checked before processing or exposing status.
7. Cache keys: include organisation and relevant outlet scope; cross-tenant cache collision test.
8. IDOR fuzz: replace each path/body/query UUID with a valid UUID from ORG_B and verify deny/no side effect.

## Evidence to retain
- Commit/version, migration state, fixture manifest (UUIDs may be synthetic), request/response status, redacted response body, database before/after counts, and test runner output.
- Run both positive and negative cases for every protected route family. Do not treat route permission middleware alone as proof of resource ownership.

## Safety
This document is a test specification, not evidence of execution. Do not run fixture creation or mutation tests against production. Live payment capture, provider dispatch and offline alcohol posting remain disabled pending their separate approvals.
