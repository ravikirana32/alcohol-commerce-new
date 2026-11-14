import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const test = read('apps/api/src/security/p554AuthorizationMatrix.test.ts');
const checks = [
 ['role matrix test harness exists', fs.existsSync(path.join(root, 'apps/api/src/security/p554AuthorizationMatrix.test.ts'))],
 ['all roles enumerated from generated matrix', /Object\.keys\(matrix\.roles\)/.test(test)],
 ['all unique permissions enumerated', /Object\.values\(matrix\.roles\)\.flat\(\)/.test(test)],
 ['positive and negative status assertions present', /toBe\(granted\.has\(permission\) \? 200 : 403\)/.test(test)],
 ['unauthenticated 401 assertion present', /toBe\(401\)/.test(test)],
 ['permission-denied response asserted', /PERMISSION_DENIED/.test(test)],
 ['test identity injection explicitly scoped to harness', /Test-only identity injection/.test(test)],
 ['P553 tenant isolation plan retained', fs.existsSync(path.join(root, 'docs/security/P553-TENANT-ISOLATION-TEST-PLAN.md'))],
 ['P553 live DB checker retained', fs.existsSync(path.join(root, 'scripts/verify-p553-live-role-matrix.mjs'))],
 ['P552 API parity verifier retained', fs.existsSync(path.join(root, 'scripts/verify-p552-api-permission-parity.mjs'))]
];
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
console.log(`P554 static verification: ${checks.filter(([, ok]) => ok).length}/${checks.length} PASS`);
if (checks.some(([, ok]) => !ok)) process.exit(1);
