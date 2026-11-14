import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const steps=[
  ['P503 quarantine disposition','scripts/verify-p503-quarantine.mjs'],
  ['P502 refund integrity','scripts/verify-p502-refund-integrity.mjs'],
  ['P501 inherited integration gate','scripts/verify-p501-integration.mjs']
];
for(const [label,script] of steps){
  const result=spawnSync(process.execPath,[script],{encoding:'utf8',timeout:90000});
  process.stdout.write(result.stdout??'');
  if(result.stderr)process.stderr.write(result.stderr);
  assert.equal(result.status,0,`${label} failed`);
  console.log(`PASS ${label}`);
}
console.log('P503 cumulative deterministic release checks: 3/3 groups passed; external runtime and compliance gates remain open.');
