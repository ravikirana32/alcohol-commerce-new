import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=process.cwd();
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const rootPackage=JSON.parse(read('package.json'));
const apiPackage=JSON.parse(read('apps/api/package.json'));
const webPackage=JSON.parse(read('apps/web/package.json'));
const version=read('VERSION').trim();
assert.equal(rootPackage.version,version,'root package version mismatch');
assert.equal(apiPackage.version,version,'API package version mismatch');
assert.equal(webPackage.version,version,'web package version mismatch');

const commands=[
 ['node',['scripts/verify-retail-checkout.mjs']],
 ['node',['scripts/verify-shift-workspace.mjs']],
 ['node',['scripts/verify-retail-sales-refunds.mjs']],
 ['node',['scripts/verify-bar-ticket-refunds.mjs']],
 ['node',['scripts/verify-inventory-workspace.mjs']],
 ['node',['scripts/check-typescript-syntax.mjs']],
 ['node',['scripts/verify-p401-p450-invariants.cjs']],
 ['node',['scripts/verify-p451-p500-invariants.cjs']],
 ['node',['scripts/verify-release-gate.mjs']],
 ['python3',['scripts/verify-migrations.py']]
];
const results=[];
for(const [bin,args] of commands){
 const p=spawnSync(bin,args,{cwd:root,encoding:'utf8',timeout:60000});
 const ok=p.status===0;
 results.push({command:[bin,...args].join(' '),ok,stdout:(p.stdout??'').trim(),stderr:(p.stderr??'').slice(-600)});
 console.log(`${ok?'PASS':'FAIL'} ${bin} ${args.join(' ')}`);
 if(!ok) console.error(p.stderr||p.stdout);
}
const failed=results.filter(r=>!r.ok);
const result={version,commands:results.length,passed:results.length-failed.length,failed:failed.length,results,productionReady:false};
const reportName = version === '0.501.0-dev' ? 'P501-INTEGRATION-VERIFICATION.json' : (version === '0.505.0-dev' ? 'P505-INHERITED-P501-VERIFICATION.json' : 'P504-INHERITED-P501-VERIFICATION.json');
fs.writeFileSync(path.join(root,reportName),JSON.stringify(result,null,2)+'\n');
if(failed.length)process.exit(1);
console.log(`P501 deterministic integration gate: ${result.passed}/${result.commands} passed; productionReady=false`);
