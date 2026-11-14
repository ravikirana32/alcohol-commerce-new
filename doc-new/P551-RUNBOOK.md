# P551 Runbook — Workspace Action Authorization

## Prerequisites

- Extract the cumulative P551 ZIP.
- Configure the local development `.env` using the P546 runbook. Demo seeding must remain disabled outside disposable local/test databases.
- Start PostgreSQL and the API/web containers using the existing Docker Compose runbook.

## Seed demo roles

```bash
# Only on a disposable local development database
DEMO_SEED_ENABLED=true DEMO_SEED_PASSWORD='Use-A-Unique-Local-Password-2026!' npm run db:seed:demo
```

Do not use this password in shared or production environments. The seeder refuses production mode and requires explicit opt-in.

## Validate source-level permission wiring

```bash
npm run verify:p551
npm run verify:p550
npm run verify:p549
npm run verify:p548
npm run check:syntax
npm run verify:migrations
```

## Run API permission tests

```bash
npm run test:permissions:p551
```

This runs the existing API permission middleware and outlet-scope suites. It does not replace per-role integration tests.

## Browser role matrix

For each demo account listed in the P546/P547 runbook:

1. Sign in and inspect `/auth/me` (or the profile request in browser developer tools).
2. Record the returned organisation, membership, outlet scope and exact `permissions` array.
3. Confirm only controls whose mapped permission is present are rendered.
4. Attempt the corresponding API mutation with the same token; verify the server independently allows or denies it.
5. Repeat with a user missing the permission and expect HTTP 403; unauthenticated requests should receive 401.
6. Repeat with a foreign organisation/outlet/resource identifier and expect denial without leaking resource details.
7. Capture browser traces, API response status, role, permission and test tenant identifiers (never record passwords or bearer tokens).

## Action mapping reference

- Catalogue: `catalogue:manage`.
- Organisation profile: `organisation:manage`; outlet changes: `outlet:manage`; team invitations/membership: `user:manage`; licence records: `licence:manage`.
- Excise: `excise:manage-rules`, `excise:review-rules`, `excise:activate-rules`, `excise:manage-conditions`, `excise:review-conditions`, `excise:manage-dry-days`, `excise:review-dry-days`.
- Tax: `tax:manage-rules`, `tax:manage-products`, `tax:manage-prices`, `tax:review-rules`, `tax:activate-rules`.
- Devices: `device:manage`.
- Offline: `offline:validate`, `offline:review`, `offline:authoritative-check`, `offline:posting-approve`, `offline:ledger-post`, `offline:recovery-manage`, `offline:recovery-compensate`.
- Trade: `trade:manage`.
- Reports export: `reports:read` or `analytics:read` (must be confirmed against the actual export API route).
- Bar service: `bar:manage`; shift operations: `shift:manage`.

## Troubleshooting

- If a control is hidden, inspect `/auth/me` and verify that the exact permission is granted to the active membership; do not add a frontend role-name exception.
- If UI shows a control but API returns 403, treat the server as authoritative and reconcile the permission mapping with the route middleware.
- If API accepts a mutation that should be denied, stop testing with business data and record a security defect; do not rely on hiding the UI control.
- Never seed demo users into production or enable live payment capture, offline alcohol posting or provider dispatch as part of this runbook.

## Release status

P551 is developer preview only. Runtime browser/API role matrix, live DB grants, tenant/outlet IDOR and full API route parity remain required before production approval.
