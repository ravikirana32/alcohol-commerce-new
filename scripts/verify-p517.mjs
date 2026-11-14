import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=(p)=>fs.readFileSync(p,'utf8');
const api=read('apps/api/src/routes/barCheckout.ts');
const integrity=read('apps/api/src/services/barCheckoutIntegrity.ts');
const migration=read('apps/api/src/db/219_p517_bar_tables_kot.sql');
const pos=read('apps/web/src/components/POSWorkspace.tsx');
const service=read('apps/web/src/components/BarServiceWorkspace.tsx');
const app=read('apps/web/src/App.tsx');
const checks=[
 ['table session schema and open-table uniqueness',migration.includes('CREATE TABLE IF NOT EXISTS bar_table_sessions')&&migration.includes('uq_bar_table_session_open_label')],
 ['ticket linked to table session',migration.includes('ADD COLUMN IF NOT EXISTS table_session_id UUID')&&api.includes('tableSessionId: uuid.optional()')],
 ['KOT header and line schema',migration.includes('CREATE TABLE IF NOT EXISTS bar_kot_orders')&&migration.includes('CREATE TABLE IF NOT EXISTS bar_kot_lines')],
 ['open table API checks licensed bar-service access',api.includes("barCheckoutRouter.post('/bar/table-sessions'")&&api.includes("checkOutletOperationalAccess(client,org,d.outletId,'BAR_SERVICE'")],
 ['table transfer updates tickets and audit trail',api.includes('BAR_TABLE_TRANSFERRED')&&api.includes('UPDATE bar_tickets SET table_label=$1 WHERE table_session_id=$2')],
 ['table merge reassigns tickets and KOTs',api.includes('BAR_TABLE_SESSIONS_MERGED')&&api.includes('UPDATE bar_kot_orders SET table_session_id=$1')&&api.includes('TABLE_CAPACITY_LIMIT')],
 ['table close blocks unfinished KOTs',api.includes('KOT_NOT_COMPLETE')&&api.includes("status NOT IN ('SERVED','CANCELLED')")],
 ['checkout creates KOT atomically',api.includes('INSERT INTO bar_kot_orders')&&api.includes('INSERT INTO bar_kot_lines')&&api.includes("await client.query('COMMIT')")],
 ['KOT transitions are state constrained',api.includes('INVALID_KOT_TRANSITION')&&api.includes("NEW:['ACCEPTED','CANCELLED']")&&api.includes("READY:['SERVED']")],
 ['KOT status updates are audited',api.includes('BAR_KOT_STATUS_CHANGED')],
 ['checkout fingerprint includes session identity',integrity.includes('tableSessionId:input.tableSessionId')],
 ['bar POS selects an open table session',pos.includes('tableSessionId')&&pos.includes('/api/v1/bar/table-sessions')],
 ['table and KOT UI is routed',app.includes('BarServiceWorkspace')&&app.includes('Tables & KOT')],
 ['service UI supports transfer merge and close',service.includes('async function transfer')&&service.includes('async function merge')&&service.includes('async function close')],
 ['service UI advances KOT lifecycle',service.includes('async function advance')&&service.includes('PREPARING')&&service.includes('SERVED')]
]
for(const [name,passed] of checks){console.log(`${passed?'PASS':'FAIL'} ${name}`);assert.ok(passed,name);}
console.log(`P517 static acceptance: PASS (${checks.length}/${checks.length})`);
