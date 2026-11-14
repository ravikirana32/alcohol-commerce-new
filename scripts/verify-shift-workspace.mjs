import fs from 'node:fs';
import assert from 'node:assert/strict';
const api=fs.readFileSync('apps/api/src/routes/operations.ts','utf8');
const settlements=fs.readFileSync('apps/api/src/routes/settlements.ts','utf8');
const ui=fs.readFileSync('apps/web/src/components/ShiftWorkspace.tsx','utf8');
const app=fs.readFileSync('apps/web/src/App.tsx','utf8');
const checks=[
 ['current open shift endpoint',/shifts\/current/.test(api)],
 ['shift scoped by organisation and outlet',/outlet_id=\$1 AND organisation_id=\$2 AND status='OPEN'/.test(api)],
 ['cash expected includes opening and cash tenders',/expectedCash=Number\(sh\.rows\[0\]\.opening_cash\)\+cashRetail\+cashBar/.test(api)],
 ['cash movement create endpoint',/shifts\/:shiftId\/cash-movements/.test(settlements)],
 ['cash movement list endpoint',/shifts\/:shiftId\/cash-movements/.test(settlements)],
 ['shift UI opens shift',/api\/v1\/shifts\/open/.test(ui)],
 ['shift UI records cash movements',/cash-movements/.test(ui)],
 ['shift UI closes and displays variance',/shifts\/\$\{shift\.id\}\/close/.test(ui)&&/variance/.test(ui)],
 ['shift management navigation',/label: 'Shift Management'/.test(app)]
];
for(const [name,ok] of checks){assert.equal(ok,true,`Failed: ${name}`);console.log('PASS',name);}
console.log(`Shift integration checks: ${checks.length}/${checks.length} passed`);
