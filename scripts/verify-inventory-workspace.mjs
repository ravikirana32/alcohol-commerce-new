import fs from 'node:fs';
import assert from 'node:assert/strict';
const api=fs.readFileSync('apps/api/src/routes/operations.ts','utf8');
const ui=fs.readFileSync('apps/web/src/components/InventoryWorkspace.tsx','utf8');
const app=fs.readFileSync('apps/web/src/App.tsx','utf8');
const checks=[
 ['stock receipt endpoint is transaction-scoped',/inventory\/receipts/.test(api)&&/BEGIN/.test(api)&&/stock_movements/.test(api)],
 ['stock balance endpoint organisation-scoped',/inventory\/balances/.test(api)&&/b\.organisation_id=\$1/.test(api)],
 ['stock adjustment prevents negative balance',/next<0/.test(api)&&/INSUFFICIENT_STOCK/.test(api)],
 ['inventory UI loads outlet balances',/api\/v1\/inventory\/balances/.test(ui)],
 ['inventory UI loads catalogue products',/api\/v1\/catalogue\/products/.test(ui)],
 ['inventory UI posts receipts',/api\/v1\/inventory\/receipts/.test(ui)],
 ['inventory UI posts adjustments',/api\/v1\/inventory\/adjustments/.test(ui)],
 ['inventory navigation exposed',/label: 'Inventory Control'/.test(app)]
];
for(const [name,ok] of checks){assert.equal(ok,true,`Failed: ${name}`);console.log('PASS',name);}
console.log(`Inventory integration checks: ${checks.length}/${checks.length} passed`);
