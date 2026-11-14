import fs from 'node:fs';
const operations=fs.readFileSync('apps/api/src/routes/operations.ts','utf8');
const ecosystem=fs.readFileSync('apps/api/src/routes/ecosystem.ts','utf8');
const procurement=fs.readFileSync('apps/api/src/routes/procurement.ts','utf8');
const checks=[
 ['outlet transfer stock debit repeats organisation and outlet scope',/UPDATE stock_balances SET quantity_units=quantity_units-\$1 WHERE organisation_id=\$4 AND outlet_id=\$2 AND product_id=\$3 AND quantity_units >= \$1/ .test(ecosystem)],
 ['outlet transfer dispatch status update repeats organisation scope',/UPDATE outlet_transfers SET status='DISPATCHED',[\s\S]{0,100}WHERE id=\$1 AND organisation_id=\$2/.test(ecosystem)],
 ['outlet transfer receipt child lookup joins scoped parent',/JOIN outlet_transfers t ON t\.id=l\.transfer_id AND t\.organisation_id=\$3 WHERE l\.id=\$1 AND l\.transfer_id=\$2/.test(ecosystem)],
 ['outlet transfer receipt child update binds scoped parent',/UPDATE outlet_transfer_lines SET received_quantity=\$1 WHERE id=\$2 AND transfer_id IN \(SELECT id FROM outlet_transfers WHERE id=\$3 AND organisation_id=\$4\)/.test(ecosystem)],
 ['outlet transfer receipt status update repeats organisation scope',/UPDATE outlet_transfers SET status='RECEIVED',[\s\S]{0,100}WHERE id=\$1 AND organisation_id=\$2/.test(ecosystem)],
 ['stock transfer dispatch child update binds scoped parent',/UPDATE stock_transfer_lines SET dispatched_units=\$1 WHERE id=\$2 AND transfer_id IN \(SELECT id FROM stock_transfers WHERE id=\$3 AND organisation_id=\$4\)/.test(operations)],
 ['stock transfer receive child update binds scoped parent',/UPDATE stock_transfer_lines SET received_units=\$1,variance_reason=\$2 WHERE id=\$3 AND transfer_id IN \(SELECT id FROM stock_transfers WHERE id=\$4 AND organisation_id=\$5\)/.test(operations)],
 ['stock transfer state updates repeat organisation scope',/UPDATE stock_transfers SET status='DISPATCHED',[\s\S]{0,120}WHERE id=\$2 AND organisation_id=\$3/.test(operations)&&/UPDATE stock_transfers SET status='RECEIVED',[\s\S]{0,120}WHERE id=\$2 AND organisation_id=\$3/.test(operations)],
 ['stock balance upserts reject conflicting other-organisation rows', (operations.match(/WHERE stock_balances\.organisation_id=EXCLUDED\.organisation_id/g)||[]).length>=4 && /WHERE stock_balances\.organisation_id=EXCLUDED\.organisation_id/.test(ecosystem)],
 ['purchase order submit repeats organisation scope',/UPDATE purchase_orders SET status='SUBMITTED' WHERE id=\$1 AND organisation_id=\$2/.test(procurement)],
 ['purchase order review mutations repeat organisation scope',/WHERE purchase_order_id=\$4 AND organisation_id=\$5 RETURNING \*/.test(procurement)&&/UPDATE purchase_orders SET status='CANCELLED' WHERE id=\$1 AND organisation_id=\$2/.test(procurement)],
 ['purchase order line receipt update binds scoped parent',/UPDATE purchase_order_lines SET received_units=received_units\+\$1 WHERE id=\$2 AND purchase_order_id=\$3 AND EXISTS \(SELECT 1 FROM purchase_orders p WHERE p\.id=purchase_order_lines\.purchase_order_id AND p\.organisation_id=\$4\)/.test(procurement)],
 ['goods receipt posting repeats organisation scope',/UPDATE goods_receipts SET status='POSTED',[\s\S]{0,100}WHERE id=\$2 AND organisation_id=\$3/.test(procurement)],
 ['approval list join matches parent organisation',/LEFT JOIN purchase_order_approvals a ON a\.purchase_order_id=p\.id AND a\.organisation_id=p\.organisation_id/.test(procurement)]
];
let failed=0;for(const [label,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${label}`);if(!ok)failed++;}
console.log(`${checks.length-failed}/${checks.length} P564 assertions passed`);if(failed)process.exit(1);
