import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const checks = [
  ['read-only PostgreSQL audit script exists', fs.existsSync(path.join(root, 'scripts/verify-p553-live-role-matrix.mjs'))],
  ['live audit requires DATABASE_URL and does not print it', /process\.env\.DATABASE_URL/.test(read('scripts/verify-p553-live-role-matrix.mjs')) && !/console\.(log|error)\([^\n]*process\.env\.DATABASE_URL/.test(read('scripts/verify-p553-live-role-matrix.mjs'))],
  ['live audit opens read-only transaction', /BEGIN READ ONLY/.test(read('scripts/verify-p553-live-role-matrix.mjs'))],
  ['live audit compares both missing and extra grants', /missing in database/i.test(read('scripts/verify-p553-live-role-matrix.mjs')) && /extra in database/i.test(read('scripts/verify-p553-live-role-matrix.mjs'))],
  ['tenant isolation plan includes cross-organisation denial', /ORG_B \/ B1/.test(read('docs/security/P553-TENANT-ISOLATION-TEST-PLAN.md'))],
  ['tenant isolation plan includes outlet scope', /A1-only cashier/.test(read('docs/security/P553-TENANT-ISOLATION-TEST-PLAN.md'))],
  ['tenant isolation plan covers IDOR and nested resources', /IDOR fuzz/.test(read('docs/security/P553-TENANT-ISOLATION-TEST-PLAN.md')) && /Nested resources/.test(read('docs/security/P553-TENANT-ISOLATION-TEST-PLAN.md'))],
  ['P552 permission matrix retained', fs.existsSync(path.join(root, 'apps/api/src/authz/permission-matrix.generated.json'))],
  ['P552 API route parity report retained', fs.existsSync(path.join(root, 'reports/P552-API-ROUTE-PERMISSION-MATRIX.json'))],
  ['no production credential literal added', !/password\s*[:=]\s*['"][^'"]{8,}['"]/i.test(read('scripts/verify-p553-live-role-matrix.mjs'))]
];
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
console.log(`P553 static verification: ${checks.filter(([, ok]) => ok).length}/${checks.length} PASS`);
if (checks.some(([, ok]) => !ok)) process.exit(1);
