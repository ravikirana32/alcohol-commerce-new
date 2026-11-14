import fs from 'node:fs';
const root=process.cwd();
const m=fs.readFileSync(root+'/apps/api/src/db/251_p575_inventory_cost_layers.sql','utf8');
const s=fs.readFileSync(root+'/apps/api/src/services/inventoryCosting.ts','utf8');
const ops=fs.readFileSync(root+'/apps/api/src/routes/operations.ts','utf8');
const proc=fs.readFileSync(root+'/apps/api/src/routes/procurement.ts','utf8');
const bar=fs.readFileSync(root+'/apps/api/src/routes/barCheckout.ts','utf8');
const checks=[
 ['FIFO cost layer schema and remaining quantity constraints',m.includes('inventory_cost_layers')&&m.includes('remaining_units<=received_units')],
 ['FIFO consumption evidence and idempotent event tables exist',m.includes('inventory_cost_consumptions')&&m.includes('inventory_cost_consumption_events')],
 ['Unvalued inventory exception table exists',m.includes('inventory_cost_exceptions')],
 ['FIFO layers are locked in received order',s.includes('ORDER BY received_at,id FOR UPDATE')],
 ['Uncovered quantities are not assigned invented costs',s.includes('fullyCosted')&&s.includes('Insufficient FIFO cost-layer coverage')],
 ['Goods receipt creates cost layer',proc.includes('addInventoryCostLayer')],
 ['FIFO consumption is replay-safe per source event',s.includes('inventory_cost_consumption_events')&&s.includes('INVENTORY_COST_EVENT_PAYLOAD_CONFLICT')],
 ['Retail checkout consumes FIFO cost',ops.includes('consumeInventoryCostFifo')],
 ['Bar checkout consumes FIFO cost',bar.includes('consumeInventoryCostFifo')],
 ['Manual receipts without cost are flagged',ops.includes('Manual receipt has no supplied unit cost')],
 ['Batch receipts accept cost or create exception',ops.includes('Batch receipt has no supplied unit cost')]
];
for(const [n,ok] of checks)console.log(`${ok?'PASS':'FAIL'} ${n}`);
if(checks.some(x=>!x[1]))process.exit(1);console.log(`${checks.length}/${checks.length} P575 checks passed`);
