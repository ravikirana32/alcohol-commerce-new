import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const spec = fs.readFileSync(path.join(root, 'tests/e2e/p542-platform-acceptance.spec.ts'), 'utf8');
const app = fs.readFileSync(path.join(root, 'apps/api/src/app.ts'), 'utf8');
const health = fs.readFileSync(path.join(root, 'apps/api/src/routes/health.ts'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'apps/web/src/App.tsx'), 'utf8');
const checks = [
  ['P542 API liveness contract covered', spec.includes('/api/health/live') && spec.includes("status: 'live'")],
  ['P542 metadata/feature flags covered', spec.includes('/api/meta') && spec.includes('livePayments')],
  ['P542 security headers covered', spec.includes('x-content-type-options') && spec.includes('x-powered-by')],
  ['P542 not-found contract covered', spec.includes('NOT_FOUND')],
  ['P542 malformed JSON contract covered', spec.includes('INVALID_JSON')],
  ['P542 readiness dependency covered', spec.includes('/api/health/ready') && health.includes("SELECT 1")],
  ['P542 browser login workflow covered', spec.includes("name: 'Welcome back'") && ui.includes('Welcome back')],
  ['P542 login input constraints covered', spec.includes("toHaveAttribute('type', 'password')")],
  ['P542 tests use Playwright test runner', spec.includes("from '@playwright/test'")],
  ['P542 no live transaction UI statement retained', ui.includes('No live transactions enabled')]
];
let failed = 0;
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++; }
console.log(`P542 static acceptance coverage: ${checks.length - failed}/${checks.length} PASS`);
if (failed) process.exit(1);
