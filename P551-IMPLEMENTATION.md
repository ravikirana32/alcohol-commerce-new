# P551 — Complete Permission Enforcement Across Remaining Workspaces

Version: `0.551.0-dev`  
Baseline: P550 cumulative ZIP  
Status: Developer preview; runtime acceptance pending

## Implemented

- Extended `apps/web/src/actionPermissions.ts` with exact action keys for catalogue, outlet, compliance review/activation, tax review/activation, offline validation/authoritative checks/posting approval/ledger posting/recovery, trade operations and report export.
- Added `ActionGuard` to privileged mutation surfaces in Catalogue, Organisation, Excise Compliance, Tax & Pricing, Offline Device, Offline Reconciliation, Offline Recovery, Trade Portal, Reports, Bar Service and Shift workspaces.
- Guarded catalogue product/category/brand/variant/price mutation forms and product import controls.
- Guarded organisation profile/outlet/licence/team invitation and membership/outlet access mutations using distinct permission keys.
- Guarded excise rule-pack submit/review/activation, rule edits, licence-hours and dry-day order mutations using separate manage/review/activate permissions.
- Guarded tax pack/component/profile/price creation, independent review and activation.
- Guarded offline validation, authoritative checks, reconciliation decisions, posting approval, ledger posting and exception recovery actions with specific permissions.
- Guarded trade order submission and transitions, report CSV export, bar table/KOT/bottle operations, shift opening/movements/closing and device diagnostic/scanner actions.
- Added `scripts/verify-p551-workspace-actions.mjs`, `npm run verify:p551` and `npm run test:permissions:p551`.
- Updated version to `0.551.0-dev`; previous role seeder, login guide, workspace navigation, and P550 action guards are retained.

## Permission mapping rules

- UI guards consume only the authenticated user's permission array and use exact permission matches.
- New action keys map only to permission codes already present in the P549 migration-derived permission catalogue; this phase adds no database grants and no role-name inference.
- Actions with distinct lifecycle responsibilities (manage, review, activate, validate, approve, post) use separate permission keys where the catalogue exposes them.
- Some UI permissions may not yet match the exact API route middleware for every action. Live route-to-permission parity remains an open release gate.

## Security boundary

`ActionGuard` controls frontend visibility only. Every mutation API must independently authenticate and enforce the matching permission, tenant membership and outlet/resource scope. A crafted HTTP request can bypass hidden UI controls. Do not treat this phase as proof of backend authorization or production security.

## Scope limits

- The 70 counted guard bindings are source-level JSX occurrences across the 11 targeted workspaces, not 70 independently runtime-tested API endpoints.
- Read-only refresh/search/navigation controls are intentionally not guarded as privileged mutations.
- This phase does not claim every individual action in every workspace is now covered; the full UI action inventory and API route registry still require reconciliation.
- Some actions in other workspaces and subflows remain open for later phases.
