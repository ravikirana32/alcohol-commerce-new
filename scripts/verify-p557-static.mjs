import fs from 'node:fs';
const checks = [
  ['P557 route audit script', 'scripts/audit-p557-tenant-route-coverage.mjs'],
  ['P556 tenant isolation harness retained', 'scripts/run-p556-tenant-isolation.mjs'],
  ['P555 authenticated API harness retained', 'scripts/run-p555-authenticated-api-matrix.mjs'],
  ['P557 cumulative gap register', 'doc-new/P513-P557-Cumulative-Gap-Register.md'],
  ['P557 route coverage report', 'doc-new/P557-TENANT-ROUTE-COVERAGE.md'],
  ['P557 machine-readable coverage', 'reports/P557-TENANT-ROUTE-COVERAGE.json']
];
let failed = 0;
for (const [label, file] of checks) { const ok = fs.existsSync(file); console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++; }
const script = fs.readFileSync('scripts/audit-p557-tenant-route-coverage.mjs', 'utf8');
for (const [label, ok] of [
  ['scanner is limited to API route source files', /apps\/api\/src\/routes/.test(script)],
  ['scanner reports static-only limitation', /not runtime proof/.test(script)],
  ['scanner records path identifiers', /pathIdentifiers/.test(script)],
  ['scanner distinguishes permission, auth and scope markers', /permissionGuard/.test(script) && /authenticationGuard/.test(script) && /explicitScopeGuardInRouteDeclaration/.test(script)]
]) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++; }
console.log(`P557 static verification: ${10-failed}/10 PASS`);
if (failed) process.exit(1);
