# P563 — Tenant Scope for Inventory & Procurement Queries

Version: `0.563.0-dev`

## Scope
P563 continues from the P562 cumulative package. It hardens tenant ownership predicates in inventory and procurement reads and parent-resource joins.

## Source changes
- Inventory balance query now requires the joined product organisation to equal the stock balance organisation.
- Inventory batch query now requires the joined product organisation to equal the batch organisation.
- Stock transfer list joins both source and destination outlets through the transfer organisation.
- Stock transfer detail lines are joined through the already organisation-scoped transfer and same-organisation product.
- Purchase-order list joins supplier and approval records using matching organisation IDs.
- Purchase-order line existence query joins the organisation-scoped parent purchase order.
- Goods receipt line lookup joins the parent purchase order and same-organisation product.
- Goods receipt remainder count joins the parent purchase order under authenticated organisation.
- Purchase-order status update repeats the organisation predicate.

These changes are defence-in-depth around parent-owned child rows. No migration or role grant was added.

## Verification
- P563 targeted source assertions: 10/10 PASS.
- P562 shift read assertions: 8/8 PASS.
- P561 update assertions: 5/5 PASS.
- P560 static verifier: 10/10 PASS.
- TypeScript syntax transpilation: 272 files, 0 diagnostics.
- SQL migration static validation: 242 ordered files PASS (static only).

## Not run / limitations
PostgreSQL integration, authenticated cross-organisation/outlet tests, API Vitest, Playwright and penetration testing were not executed in this environment. Source assertions do not prove database runtime isolation or concurrency behaviour. The P560 review queue remains open (188 tenant-bearing candidates and 71 schema-unresolved candidates, as previously reported). Production remains NO-GO.
