# P513 — Technical Integration and Build Stabilisation

**Version:** `0.513.0-dev`  
**Baseline:** P512  
**Status:** Partial — source-level integration fixes implemented; dependency-backed build and runtime verification remain blocked in this execution environment.

## Implemented

- Added one authoritative root `VERSION` value and a deterministic synchronisation script for root/API/web package versions and generated TypeScript constants.
- Updated API root metadata to use the generated application version instead of a stale hardcoded value.
- Added `/api/meta` for runtime version, environment and explicitly enabled feature-flag visibility. Secrets are not returned.
- Updated the authenticated web shell footer to use the generated application version instead of a stale P501 version.
- Standardised API 404 responses with the request correlation ID.
- Improved API error mapping for malformed JSON (400), oversized JSON payloads (413), other client errors and unexpected server errors. Internal exception messages are logged server-side but not exposed to clients.
- Added a deterministic P513 static verification script and npm commands for version synchronisation and P513 verification.

## Verification

- `node scripts/sync-version.mjs` — PASS.
- `npm run verify:p513` — PASS.
- TypeScript syntax transpilation — PASS, 219 files / 0 diagnostics.
- SQL migration static validation — PASS, 215 ordered SQL files.
- P506–P512 inherited static checks — PASS where executed; P506 live API smoke returned HTTP 404 at the configured localhost endpoint and is recorded as an environment/runtime failure. P510/P511 script wiring was repaired as part of P513.
- Dependency-backed API/web typecheck, production build, Vitest, Playwright and live database/API workflows require dependency installation and runtime services. These were not claimed as passed. The P506 live API smoke probe also returned HTTP 404 for all three unauthenticated endpoints at `http://localhost:8080`; a valid P506 runtime result remains outstanding.

## Remaining / carried forward

- Generate and commit `package-lock.json` using the supported network-enabled build environment; the package-lock-only attempt timed out before producing a lockfile.
- Run clean `npm ci`, API/web typecheck and production builds.
- Run API and browser integration tests against PostgreSQL/Redis.
- Continue route-contract coverage and full CI pipeline in P513 hardening follow-up/P526 release verification.

## Acceptance decision

P513 is **PARTIAL**, not complete. The source integration defects fixed here are verifiable statically, but a clean dependency-backed build and runtime smoke test are required before this phase can be marked complete.
