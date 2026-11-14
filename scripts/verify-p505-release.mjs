import { spawnSync } from 'node:child_process';
const commands = [
  ['P505 environment preflight', ['scripts/verify-p505-env.mjs']],
  ['P504 Docker configuration', ['scripts/verify-p504-docker.mjs']],
  ['P504 release checks', ['scripts/verify-p504-release.mjs']],
  ['P503 release checks', ['scripts/verify-p503-release.mjs']],
  ['P502 refund integrity', ['scripts/verify-p502-refund-integrity.mjs']],
  ['P501 integration checks', ['scripts/verify-p501-integration.mjs']],
  ['migration static checks', ['scripts/verify-migrations.py']],
  ['TypeScript syntax scan', ['scripts/check-typescript-syntax.mjs']]
];
let failed=0;
for (const [label,args] of commands) {
  const isPy=args[0].endsWith('.py');
  const result=spawnSync(isPy?'python3':'node',args,{stdio:'inherit'});
  const ok=result.status===0;
  console.log(`${ok?'PASS':'FAIL'} ${label}`);
  if(!ok) failed++;
}
console.log(`P505 release gate: ${commands.length-failed}/${commands.length} passed`);
process.exitCode=failed?1:0;
