import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const commands = [
  ['P504 Docker orchestration static checks', 'scripts/verify-p504-docker.mjs'],
  ['P503/P502/P501 cumulative deterministic checks', 'scripts/verify-p503-release.mjs'],
  ['TypeScript/TSX syntax scan', 'scripts/check-typescript-syntax.mjs'],
  ['Migration static validation', 'scripts/verify-migrations.py']
];
let passed = 0;
for (const [label, script] of commands) {
  const python = script.endsWith('.py');
  const result = spawnSync(python ? 'python3' : process.execPath, [script], { encoding: 'utf8', timeout: 120000 });
  process.stdout.write(result.stdout ?? '');
  if (result.stderr) process.stderr.write(result.stderr);
  assert.equal(result.status, 0, `${label} failed`);
  passed++;
  console.log(`PASS ${label}`);
}
console.log(`P504 deterministic release gate: ${passed}/${commands.length} groups passed.`);
console.log('Docker engine execution, dependency-backed builds, PostgreSQL runtime integration, browser E2E and external compliance/security gates are not covered by this static gate.');
