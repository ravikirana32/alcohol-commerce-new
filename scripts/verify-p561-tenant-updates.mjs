import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const checks = [
  ['bar KOT status update scoped by organisation', 'apps/api/src/routes/barCheckout.ts', /UPDATE bar_kot_orders[\s\S]{0,260}WHERE id=\$3 AND organisation_id=\$4/],
  ['offline recovery triage update scoped by organisation', 'apps/api/src/routes/offlineRecovery.ts', /UPDATE offline_recovery_cases[\s\S]{0,240}WHERE id=\$3 AND organisation_id=\$4/],
  ['finance journal posting update scoped by organisation', 'apps/api/src/routes/finance.ts', /UPDATE finance_journals[\s\S]{0,180}WHERE id=\$1 AND organisation_id=\$2/],
  ['retail sale refund status update scoped by organisation', 'apps/api/src/routes/settlements.ts', /UPDATE retail_sales[\s\S]{0,300}WHERE id=\$2 AND organisation_id=\$3/],
  ['outlet shift close update scoped by organisation', 'apps/api/src/routes/operations.ts', /UPDATE outlet_shifts[\s\S]{0,350}WHERE id=\$6 AND organisation_id=\$7/],
];
let failed = 0;
for (const [label, file, pattern] of checks) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const ok = pattern.test(source);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  if (!ok) failed++;
}
console.log(`${checks.length-failed}/${checks.length} P561 source assertions passed`);
if (failed) process.exit(1);
