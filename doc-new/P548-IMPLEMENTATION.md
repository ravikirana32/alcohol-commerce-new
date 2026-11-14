# P548 — Frontend Role-Based Navigation & Screen Authorization

Version: `0.548.0-dev`  
Baseline: P547 cumulative ZIP  
Status: Developer preview; static checks only.

## Implemented

- Added a navigation-to-permission policy for Retail POS, Bar POS, shift, sales/refunds, bar tickets, tables/KOT, inventory, organisation/team, catalogue, procurement, offline/device, brand/distributor/trade, reports, compliance, tax/pricing, finance and settings workspaces.
- Navigation items are filtered against the `permissions` array returned by the authenticated `/api/v1/auth/me` principal. Permission matching is exact; no wildcard or role-name inference is used.
- The active workspace is checked again before rendering. If a user's permissions no longer include the active workspace, its content is replaced with an access-restricted message.
- The app waits for the authenticated principal refresh after a token change before relying on permissions.
- Added `apps/web/src/accessControl.ts` as a small exact-match policy helper and `scripts/verify-p548.mjs` as a deterministic source verifier.
- Added `npm run verify:p548` and synchronized all package versions to `0.548.0-dev`.

## Security boundary

This is a frontend visibility and navigation safeguard, not authorization enforcement. API routes must continue to use `authenticate` and `requirePermission`; direct HTTP calls cannot be secured by hiding menu items. No backend permission was granted or broadened in P548.

## Permission mapping notes

Each workspace is visible when at least one listed permission is present. The map uses existing permission codes found in the application migration set. `Overview` remains available to any authenticated principal. A module with no matching permission is hidden. The mapping is a conservative UI policy and requires owner review against the full route matrix.

## Not completed

- Browser tests for every role and workspace.
- Runtime checks against a live `/auth/me` response for every seeded role.
- Full mapping of every button/action within each workspace; API authorization remains authoritative.
- Screen-level outlet scoping in the UI; server-side scope enforcement remains required.
- Accessibility and responsive navigation regression on desktop/tablet/mobile.
