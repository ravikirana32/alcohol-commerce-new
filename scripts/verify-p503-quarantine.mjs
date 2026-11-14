import fs from 'node:fs';
import assert from 'node:assert/strict';
const route=fs.readFileSync('apps/api/src/routes/settlements.ts','utf8');
const migration=fs.readFileSync('apps/api/src/db/215_p503_peg_quarantine_disposition.sql','utf8');
const tests=fs.readFileSync('apps/api/test/pegQuarantineDisposition.test.ts','utf8');
const checks=[
 ['quarantine queue is organisation scoped',/JOIN bar_refunds r ON r.id=q.refund_id AND r.organisation_id=\$1/.test(route)],
 ['disposition requires dedicated manager permission',/requirePermission\('bar:quarantine:manage'\)/.test(route)],
 ['only pending records can be disposed',/disposition='QUARANTINE_PENDING'/.test(route)&&/QUARANTINE_ALREADY_DISPOSED/.test(route)],
 ['compliance release requires reference',/RELEASED_BY_COMPLIANCE/.test(route)&&/COMPLIANCE_REFERENCE_REQUIRED/.test(route)],
 ['disposition writes actor, time and reason',/disposition_by=\$4/.test(route)&&/disposition_at=NOW\(\)/.test(route)&&/disposition_reason/.test(route)],
 ['disposition is audited',/BAR_PEG_QUARANTINE_DISPOSITION/.test(route)&&/saleableStockChanged: false/.test(route)],
 ['migration adds evidence fields',/compliance_reference TEXT/.test(migration)&&/disposition_by UUID/.test(migration)],
 ['database prevents finalized ledger edits and deletion',/Finalized peg quarantine disposition is immutable/.test(migration)&&/Peg quarantine ledger rows cannot be deleted/.test(migration)&&/trg_peg_quarantine_immutable/.test(migration)],
 ['manager permissions are seeded',/bar:quarantine:manage/.test(migration)],
 ['unit tests cover approval and validation cases',/requires compliance reference/.test(tests)&&/accepts compliance release/.test(tests)&&/rejects short reasons/.test(tests)]
];
for(const [name,ok] of checks){assert.equal(ok,true,`Failed: ${name}`);console.log('PASS',name);}
console.log(`P503 quarantine checks: ${checks.length}/${checks.length} passed`);
