import fs from 'node:fs';
import assert from 'node:assert/strict';
const settlement=fs.readFileSync('apps/api/src/routes/settlements.ts','utf8');
const retailUi=fs.readFileSync('apps/web/src/components/RetailSalesWorkspace.tsx','utf8');
const barUi=fs.readFileSync('apps/web/src/components/BarTicketsWorkspace.tsx','utf8');
const migration=fs.readFileSync('apps/api/src/db/214_p502_refund_inventory_allocations.sql','utf8');
const checks=[
 ['retail restock requires explicit line allocations',/RESTOCK_ALLOCATION_REQUIRED/.test(settlement)&&/restockAllocations/.test(settlement)],
 ['retail allocation verifies original sale line',/sale_line_id/.test(settlement)&&/INVALID_RESTOCK_LINE/.test(settlement)],
 ['retail allocation caps cumulative SKU quantity',/RESTOCK_QUANTITY_EXCEEDED/.test(settlement)&&/SUM\(quantity\)/.test(settlement)],
 ['retail stock balance update is conflict-safe',/ON CONFLICT\(outlet_id,product_id\)/.test(settlement)],
 ['retail restock has immutable refund-line ledger',/retail_refund_restock_lines/.test(migration)],
 ['retail UI captures quantity per SKU',/restockAllocations/.test(retailUi)&&/available/.test(retailUi)],
 ['bar restoration is restricted to original PEG line',/INVALID_PEG_REFUND_LINE/.test(settlement)&&/line_type!=='PEG'/.test(settlement)],
 ['bar restoration caps cumulative sold ml',/PEG_RESTORATION_EXCEEDS_SOLD_VOLUME/.test(settlement)&&/SUM\(volume_ml\)/.test(settlement)],
 ['bar returned volume is quarantined, never returned to saleable bottle',/QUARANTINE_PENDING/.test(settlement)&&!/UPDATE open_bottles SET remaining_ml=remaining_ml\+/.test(settlement)],
 ['bar peg restoration has auditable ledger',/bar_refund_peg_restorations/.test(migration)&&/peg_transactions/.test(settlement)],
 ['bar UI records returned volume by ticket line',/pegRestorations/.test(barUi)&&/quarantine/.test(barUi)]
];
for(const [name,ok] of checks){assert.equal(ok,true,`Failed: ${name}`);console.log('PASS',name);}
console.log(`P502 refund integrity checks: ${checks.length}/${checks.length} passed`);
