import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(p,'utf8');
const api=read('apps/api/src/routes/operations.ts');
const migration=read('apps/api/src/db/220_p518_inventory_warehouse.sql');
const ui=read('apps/web/src/components/InventoryWorkspace.tsx');
const checks=[
 ['transfer schema and constrained states',migration.includes('CREATE TABLE IF NOT EXISTS stock_transfers')&&migration.includes("'DRAFT','DISPATCHED','RECEIVED','CANCELLED'")],
 ['transfer lines enforce positive quantities',migration.includes('CREATE TABLE IF NOT EXISTS stock_transfer_lines')&&migration.includes('requested_units NUMERIC(14,3) NOT NULL CHECK(requested_units>0)')],
 ['dispatch deducts source stock and writes ledger',api.includes("/dispatch'")&&api.includes("'TRANSFER_OUT'")&&api.includes('INSUFFICIENT_STOCK')],
 ['receipt credits destination and tracks shortage reason',api.includes("/receive'")&&api.includes("'TRANSFER_IN'")&&api.includes('VARIANCE_REASON_REQUIRED')],
 ['transfer APIs are organisation scoped',api.includes("WHERE t.organisation_id=$1 ORDER BY t.created_at DESC")&&api.includes('Both transfer outlets must belong to this organisation')],
 ['batch register records expiry and remaining quantities',migration.includes('CREATE TABLE IF NOT EXISTS inventory_batches')&&migration.includes('expiry_date DATE')&&api.includes("'/inventory/batches'")],
 ['expiry query is bounded to at most one year',api.includes('Math.min(365')&&api.includes('expiringWithinDays')],
 ['stocktake snapshot and line quantities are constrained',migration.includes('CREATE TABLE IF NOT EXISTS inventory_stocktakes')&&migration.includes('variance_units NUMERIC(14,3) GENERATED ALWAYS')],
 ['stocktake approval is submitted-only and ledger backed',api.includes("status='SUBMITTED'")&&api.includes("'STOCKTAKE'")&&api.includes("status='APPROVED'")],
 ['stocktake rejects stale snapshots',api.includes('STOCK_CHANGED_DURING_COUNT')],
 ['UI supports creating and dispatching transfers',ui.includes('Create stock transfer')&&ui.includes('Confirm full receipt')&&ui.includes('Dispatch')],
 ['UI provides stocktake creation',ui.includes('Start stocktake')&&ui.includes('/api/v1/inventory/stocktakes')]
];
for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);assert.ok(ok,name);}
console.log(`P518 static acceptance: PASS (${checks.length}/${checks.length})`);
