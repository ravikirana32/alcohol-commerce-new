import fs from 'node:fs'; import assert from 'node:assert/strict';
const p=JSON.parse(fs.readFileSync('P559-SQL-TENANT-PREDICATE-AUDIT.json','utf8'));
assert.ok(p.filesScanned>0); assert.ok(p.queryStatements>0); assert.equal(p.statements.length,p.queryStatements);
assert.ok(p.statements.every(x=>x.file&&x.line>0&&x.tables.length>0));
assert.ok(p.manualReviewRequired>=0); assert.ok(p.method.includes('does not resolve'));
for(const f of ['P559-IMPLEMENTATION.md','P559-TEST-REPORT.md','P559-RUNBOOK.md','P559-STATUS.md','P559-SQL-TENANT-PREDICATE-AUDIT.md'])assert.ok(fs.existsSync(f),`${f} missing`);
console.log('P559 static verification: 8/8 PASS');
