# P550 — Complete Workspace Action Authorization

Version: `0.550.0-dev`  
Baseline: P549 cumulative ZIP  
Status: Developer preview; runtime acceptance pending

## Implemented

- Added `apps/web/src/ActionGuard.tsx` with a React permission context, `PermissionProvider`, `useActionPermission` and `ActionGuard`.
- The provider receives the authenticated `/auth/me` profile's permission array. No role-name inference or wildcard grants are used.
- Guarded retail and bar checkout controls separately (`retail.checkout`, `bar.checkout`).
- Guarded retail and bar refund controls (`retail.refund`, `bar.refund`).
- Guarded inventory receipt and adjustment submit controls (`inventory.receive`, `inventory.adjust`).
- Guarded procurement supplier creation/submission and approval/rejection (`procurement.manage`, `procurement.approve`).
- Guarded finance mapping/period creation and period close (`finance.manage`, `finance.period.close`).
- Added `scripts/verify-p550-actions.mjs`, `npm run verify:p550` and `npm run test:permissions:p550`.
- Preserved P549 generated role/permission matrix, seeded user implementation, previous workspace functionality and backend permission middleware.

## Security boundary

This phase controls UI affordances only. Every API route must continue to authenticate and enforce the corresponding permission server-side. Hiding a button does not prevent a crafted HTTP request. A few guarded operations use the nearest existing permission in the P549 catalogue; those mappings require confirmation against the live route middleware and business policy before production.

## Known scope limits

P550 wires 10 action bindings across POS, inventory, procurement, finance, retail refund and bar refund screens. It does not claim every button/form across every workspace is guarded. Read-only refresh, selection and navigation controls are intentionally not treated as privileged mutations. Other action controls, including offline reconciliation, compliance, devices, catalogue, organisation/team, tax/pricing, trade and reporting exports, remain for subsequent phases and live permission review.
