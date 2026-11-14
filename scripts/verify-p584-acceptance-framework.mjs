import fs from 'node:fs';
import assert from 'node:assert/strict';
const plan=fs.readFileSync('doc-new/P584-ACCEPTANCE-PLAN.md','utf8');
const template=JSON.parse(fs.readFileSync('reports/P584-EVIDENCE-TEMPLATE.json','utf8'));
const p585=JSON.parse(fs.readFileSync('reports/P585-PRODUCTION-RELEASE-GATES.json','utf8'));
const required=['Identity and access','Retail POS','Bar POS','Procurement','Finance','Regulatory','Device/offline','Integrations','Security/reliability','Accessibility'];
for(const [n,v] of Object.entries({
 'workstreams cover core platform':required.every(x=>plan.includes(x)),
 'runtime execution required':plan.includes('actual runtime execution'),
 'evidence template starts NOT_RUN':template.result==='NOT_RUN',
 'evidence requires build and migration identity':!!('buildSha' in template)&&!!('migrationChecksum' in template),
 'no invented execution':template.executedAt===null&&template.evidenceUri===null,
 'release gates defined':p585.gates.length>=13,
 'all gate IDs unique':new Set(p585.gates.map(x=>x.id)).size===p585.gates.length
})){assert.ok(v,n);console.log('PASS',n);}
