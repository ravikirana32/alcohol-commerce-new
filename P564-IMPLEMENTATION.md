# P564 — Tenant-Safe Transfer, Receipt & Stock Mutations

Version: `0.564.0-dev`

## Scope
P564 continues from the P563 cumulative package. It hardens high-risk inventory transfer and procurement mutations by repeating authenticated organisation scope at the mutation boundary and by binding child-row updates to their organisation-owned parent.

## Changes
- Outlet-transfer source stock debit now repeats organisation, outlet and product predicates and checks that the conditional debit affected a row.
- Outlet-transfer dispatch and receipt state updates repeat organisation scope.
- Outlet-transfer receipt child lookup joins the parent transfer under the authenticated organisation; child update is constrained through that parent.
- Stock-transfer dispatch and receipt child-row updates are constrained through the organisation-scoped parent transfer.
- Stock-transfer state transitions repeat organisation scope.
- Stock balance conflict updates in the touched transfer, stocktake and receipt paths update only when the existing balance belongs to the same organisation.
- Purchase-order submit and reject state updates repeat organisation scope.
- Purchase-order approval update is constrained by organisation; approval upsert refuses to update a conflicting row owned by another organisation.
- Purchase-order line received-quantity mutation is bound to the requested PO and verifies the parent PO organisation.
- Goods-receipt posting repeats organisation scope; approval list join matches the PO organisation.
- Added `scripts/verify-p564-tenant-scoped-mutations.mjs` and npm scripts `verify:p564` / `verify:p564:static`.

No migration or permission grant was added. Changes are limited to source predicates and static verification.

## Verification
- P564 targeted assertions: 14/14 PASS.
- P563 inventory/procurement assertions: 10/10 PASS.
- P562 shift read assertions: 8/8 PASS.
- P561 update assertions: 5/5 PASS.
- TypeScript syntax transpilation: 272 files, 0 diagnostics.
- SQL migration static validation: 242 ordered files PASS (static only).

## Limitations / open gates
PostgreSQL execution, concurrent dispatch/receipt tests, live cross-organisation and cross-outlet API tests, Vitest, Playwright and penetration testing were not run. The source assertions do not establish runtime isolation, row-level locking correctness, or end-to-end inventory ledger consistency. The previously reported P560 SQL review queues remain open. Production remains NO-GO.
