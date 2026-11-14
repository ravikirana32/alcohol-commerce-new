import fs from 'node:fs';
const read = (p) => fs.readFileSync(p, 'utf8');
const runner = read('scripts/run-p555-authenticated-api-matrix.mjs');
const plan = read('docs/security/P555-AUTHENTICATED-API-MATRIX.md');
const auth = read('apps/api/src/middleware/authenticate.ts');
const checks = [
  ['live harness uses actual login endpoint', /\/api\/auth\/login/.test(runner)],
  ['live harness sends bearer token to protected routes', /authorization: `Bearer \$\{token\}`/.test(runner)],
  ['live harness rejects unsafe write route methods', /GET', 'HEAD'/.test(runner)],
  ['live harness verifies permission-denied response', /PERMISSION_DENIED/.test(runner)],
  ['live harness verifies session revocation', /\/api\/auth\/logout/.test(runner) && /\/api\/auth\/me/.test(runner)],
  ['live harness suppresses response bodies on login errors', /response body suppressed/.test(runner)],
  ['auth middleware reloads session from database', /FROM auth_sessions s/.test(auth)],
  ['auth middleware reloads organisation membership', /FROM organisation_memberships/.test(auth)],
  ['runtime plan documents disposable credentials', /disposable test deployment/.test(plan)],
  ['P554 test-only identity harness remains distinct', fs.existsSync('apps/api/src/security/p554AuthorizationMatrix.test.ts')]
];
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
console.log(`P555 static verification: ${checks.filter(([, ok]) => ok).length}/${checks.length} PASS`);
if (checks.some(([, ok]) => !ok)) process.exit(1);
