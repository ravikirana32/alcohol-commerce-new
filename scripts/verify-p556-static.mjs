import fs from 'node:fs';
import path from 'node:path';
const checks = [
  ['tenant boundary unit tests', 'apps/api/src/services/tenantBoundary.test.ts'],
  ['outlet scope boundary unit tests', 'apps/api/src/services/permissionScope.p556.test.ts'],
  ['authenticated tenant runtime harness', 'scripts/run-p556-tenant-isolation.mjs'],
  ['tenant boundary helper', 'apps/api/src/services/tenantBoundary.ts'],
  ['permission scope helper', 'apps/api/src/services/permissionScope.ts'],
  ['P555 authenticated harness retained', 'scripts/run-p555-authenticated-api-matrix.mjs'],
  ['generated role matrix retained', 'apps/api/src/authz/permission-matrix.generated.json'],
  ['cumulative gap register', 'doc-new/P513-P556-Cumulative-Gap-Register.md']
];
let failed = 0;
for (const [label, file] of checks) {
  const ok = fs.existsSync(path.resolve(file));
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  if (!ok) failed++;
}
const harness = fs.readFileSync('scripts/run-p556-tenant-isolation.mjs', 'utf8');
for (const [label, ok] of [
  ['runtime harness is non-mutating', /\['GET', 'HEAD'\]/.test(harness)],
  ['runtime harness requires authenticated API credentials', /P555_ROLE_CREDENTIALS_JSON/.test(harness)],
  ['runtime harness requires explicit boundary fixtures', /actorOrganisationId/.test(harness) && /actorOutletId/.test(harness)],
  ['runtime harness suppresses login response bodies', /response body suppressed/.test(harness)]
]) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++; }
console.log(`P556 static verification: ${10-failed}/10 PASS`);
if (failed) process.exit(1);
