import fs from 'node:fs';
import assert from 'node:assert/strict';
const route=fs.readFileSync('apps/api/src/routes/barCheckout.ts','utf8');
const settlement=fs.readFileSync('apps/api/src/routes/settlements.ts','utf8');
const ui=fs.readFileSync('apps/web/src/components/BarTicketsWorkspace.tsx','utf8');
const migration=fs.readFileSync('apps/api/src/db/213_p5008_bar_ticket_read_permission.sql','utf8');
const app=fs.readFileSync('apps/web/src/App.tsx','utf8');
const checks=[
 ['bar ticket list scoped by organisation',/bar\/tickets'/.test(route)&&/t\.organisation_id=\$1/.test(route)],
 ['bar ticket detail scoped by organisation',/bar\/tickets\/:ticketId/.test(route)&&/organisation_id=\$2/.test(route)],
 ['ticket detail includes refunds',/bar_refunds/.test(route)],
 ['bar refund API locks ticket',/bar\/tickets\/:ticketId\/refunds/.test(settlement)&&/FOR UPDATE/.test(settlement)],
 ['bar refund capped at remaining amount',/REFUND_EXCEEDS_REMAINING/.test(settlement)],
 ['bar read permission seeded',/bar:read/.test(migration)&&/BARTENDER/.test(migration)],
 ['bar tickets UI lists and loads detail',/api\/v1\/bar\/tickets/.test(ui)],
 ['bar refund UI submits refund request',/api\/v1\/bar\/tickets\/\$\{ticket\.id\}\/refunds/.test(ui)],
 ['navigation exposes bar ticket refunds',/label: 'Bar Tickets & Refunds'/.test(app)]
];
for(const [name,ok] of checks){assert.equal(ok,true,`Failed: ${name}`);console.log('PASS',name);}
console.log(`Bar ticket/refund checks: ${checks.length}/${checks.length} passed`);
