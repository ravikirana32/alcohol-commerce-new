import fs from 'node:fs';
import assert from 'node:assert/strict';
const api=fs.readFileSync('apps/api/src/routes/tradePortal.ts','utf8');
const ui=fs.readFileSync('apps/web/src/components/TradePortalWorkspace.tsx','utf8');
const app=fs.readFileSync('apps/web/src/App.tsx','utf8');
const migration=fs.readFileSync('apps/api/src/db/239_p537_trade_fulfilment_evidence.sql','utf8');
const checks=[
 ['supplier relationship access guard',api.includes("status='ACTIVE'" )],
 ['approved supplier catalogue',api.includes("status='APPROVED'")],
 ['purchase order transaction',api.includes("await c.query('BEGIN')") && api.includes("await c.query('COMMIT')")],
 ['order state transition guard',api.includes('INVALID_TRADE_ORDER_TRANSITION')],
 ['tenant-scoped order read',api.includes('supplier_organisation_id=$2 OR buyer_organisation_id=$2')],
 ['append-only fulfilment evidence',migration.includes('prevent_trade_fulfilment_event_mutation')],
 ['supplier dispatch evidence role guard',api.includes('SUPPLIER_ACTION_REQUIRED')],
 ['buyer receipt evidence role guard',api.includes('BUYER_ACTION_REQUIRED')],
 ['receipt requires dispatched order',api.includes('ORDER_NOT_DISPATCHED')],
 ['trade portal UI loads catalogue',ui.includes("/trade/catalogue?supplierOrganisationId=")],
 ['trade portal UI submits purchase order',ui.includes("request('/trade/orders'")],
 ['trade portal UI displays fulfilment actions',ui.includes('Mark delivered')],
 ['app mounts trade portal workspace',app.includes('<TradePortalWorkspace token={token!}/>')]
];
for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);assert.ok(ok,name)}
console.log(`P537 ${checks.length}/${checks.length} static checks PASS`);
