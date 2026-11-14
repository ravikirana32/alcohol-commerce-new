import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const operations=fs.readFileSync(path.join(root,'apps/api/src/routes/operations.ts'),'utf8');
const procurement=fs.readFileSync(path.join(root,'apps/api/src/routes/procurement.ts'),'utf8');
const checks=[
 ['inventory balance joins product within same organisation',/FROM stock_balances b JOIN products p ON p\.id=b\.product_id AND p\.organisation_id=b\.organisation_id[\s\S]{0,140}WHERE b\.organisation_id=\$1/],
 ['inventory batch joins product within same organisation',/FROM inventory_batches b JOIN products p ON p\.id=b\.product_id AND p\.organisation_id=b\.organisation_id[\s\S]{0,140}WHERE b\.organisation_id=\$1/],
 ['transfer list constrains both outlet joins to transfer organisation',/JOIN outlets so ON so\.id=t\.source_outlet_id AND so\.organisation_id=t\.organisation_id JOIN outlets do ON do\.id=t\.destination_outlet_id AND do\.organisation_id=t\.organisation_id/],
 ['transfer detail lines bind parent transfer organisation',/JOIN stock_transfers t ON t\.id=l\.transfer_id AND t\.organisation_id=\$2 JOIN products p ON p\.id=l\.product_id AND p\.organisation_id=t\.organisation_id WHERE l\.transfer_id=\$1/],
 ['purchase order list constrains supplier organisation',/LEFT JOIN suppliers s ON s\.id=p\.supplier_id AND s\.organisation_id=p\.organisation_id/],
 ['purchase order list constrains approval organisation',/LEFT JOIN purchase_order_approvals a ON a\.purchase_order_id=p\.id AND a\.organisation_id=p\.organisation_id/],
 ['purchase order line existence joins organisation-owned parent',/FROM purchase_order_lines l JOIN purchase_orders p ON p\.id=l\.purchase_order_id AND p\.organisation_id=\$2 WHERE l\.purchase_order_id=\$1/],
 ['receipt line binds purchase order and product organisation',/JOIN purchase_orders po ON po\.id=pol\.purchase_order_id AND po\.organisation_id=\$3 JOIN products p ON p\.id=pol\.product_id AND p\.organisation_id=po\.organisation_id/],
 ['receipt remainder query scopes parent purchase order',/FROM purchase_order_lines l JOIN purchase_orders p ON p\.id=l\.purchase_order_id AND p\.organisation_id=\$2 WHERE l\.purchase_order_id=\$1/],
 ['purchase order status update repeats organisation predicate',/UPDATE purchase_orders SET status=\$1 WHERE id=\$2 AND organisation_id=\$3/]
];
let failed=0;
for(const [label,re] of checks){const ok=re.test(label.startsWith('inventory')||label.startsWith('transfer')?operations:procurement);console.log(`${ok?'PASS':'FAIL'} ${label}`);if(!ok)failed++;}
console.log(`${checks.length-failed}/${checks.length} P563 source assertions passed`);
if(failed)process.exit(1);
