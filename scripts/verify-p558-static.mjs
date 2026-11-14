import fs from 'node:fs'; import assert from 'node:assert/strict';
const p=JSON.parse(fs.readFileSync('reports/P558-RESOURCE-OWNERSHIP-AUDIT.json','utf8'));
assert.equal(p.unmarkedRoutes.length,10); assert.equal(p.checks.length,8); assert.ok(p.checks.every(x=>x.passed));
assert.ok(p.unmarkedRoutes.every(x=>x.disposition && x.disposition!=='manual-review-required'));
for(const f of ['doc-new/P558-IMPLEMENTATION.md','doc-new/P558-TEST-REPORT.md','doc-new/P558-RUNBOOK.md','doc-new/P558-STATUS.md','doc-new/P558-RESOURCE-OWNERSHIP-AUDIT.md']) assert.ok(fs.existsSync(f),`${f} missing`);
console.log('P558 static verification: 10/10 PASS');
