# P584–P585 Implementation Report

## P584 — End-to-end, UAT and business acceptance
- Added comprehensive acceptance plan spanning identity/RBAC/tenant isolation, retail, bar, procurement, finance, regulatory, device/offline, integrations, security/reliability and accessibility.
- Added structured evidence template requiring environment, build SHA, migration checksum, actor, organisation/outlet fixtures, expected/actual results, timestamp and evidence URI.
- Added executable runtime smoke script for liveness, readiness, API metadata version and live-payment flag.
- Explicitly distinguishes static verification from actual runtime acceptance. No test is marked PASS without retained execution evidence.
- Outstanding: execute against provisioned PostgreSQL/Docker environment, full API/browser/mobile E2E, tenant negative tests, load/concurrency, penetration, backup/restore, finance/legal UAT and pilot acceptance.

## P585 — Pilot, production readiness and go-live
- Added 13 mandatory production release gates with owner and evidence requirements.
- Added machine-readable NO_GO manifest with all gates NOT_RUN until verified.
- Preserved hard-disabled live payment, provider dispatch and offline alcohol financial posting.
- Added production deployment checklist, abort conditions, rollback safety guidance and release runbook.
- Existing final release evidence policy remains the authority: all critical build, typecheck, migration, E2E, security, legal, provider, restore, pilot, support and rollback evidence must pass.
- Outstanding: obtain independently reviewable evidence and named approvals for every mandatory gate; perform actual deployment/pilot/rollback drills. The current environment cannot run PostgreSQL/Docker or full workspace dependency-backed checks.

## Release decision
P585 is NOT a production approval. Current release decision remains NO-GO. The project has a documented, executable path to close the remaining gaps, but runtime evidence and external sign-offs cannot be fabricated or safely inferred.
