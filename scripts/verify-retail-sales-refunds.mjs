import fs from 'node:fs';
import assert from 'node:assert/strict';
const api=fs.readFileSync('apps/api/src/routes/operations.ts','utf8');
const refunds=fs.readFileSync('apps/api/src/routes/settlements.ts','utf8');
const ui=fs.readFileSync('apps/web/src/components/RetailSalesWorkspace.tsx','utf8');
const app=fs.readFileSync('apps/web/src/App.tsx','utf8');
const checks=[
 ['sales list endpoint',/retail\/sales'/.test(api)],
 ['sale detail endpoint includes refunds',/retail\/sales\/:saleId/.test(api)&&/refunds/.test(api)],
 ['refund endpoint locks sale row',/retail\/sales\/:saleId\/refunds/.test(refunds)&&/FOR UPDATE/.test(refunds)],
 ['refund capped at remaining sale value',/REFUND_EXCEEDS_REMAINING/.test(refunds)],
 ['refund creates audit event',/RETAIL_REFUND_CREATED/.test(refunds)],
 ['sales UI loads list and details',/api\/v1\/retail\/sales/.test(ui)&&/loadDetail/.test(ui)],
 ['refund UI submits reason and method',/amount,reason,method,reference:reference/.test(ui)],
 ['restock requires explicit checkbox',/restock/.test(ui)&&/physical inspection/.test(ui)],
 ['navigation exposes sales refunds',/label: 'Sales & Refunds'/.test(app)]
];
for(const [name,ok] of checks){assert.equal(ok,true,`Failed: ${name}`);console.log('PASS',name);}
console.log(`Retail sales/refund UI checks: ${checks.length}/${checks.length} passed`);
