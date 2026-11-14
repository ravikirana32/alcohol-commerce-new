import fs from 'node:fs';
import assert from 'node:assert/strict';
const app = fs.readFileSync('apps/web/src/App.tsx', 'utf8');
const policy = fs.readFileSync('apps/web/src/accessControl.ts', 'utf8');
const checks = [
  ['permission map exists', app.includes('navigationPermissions')],
  ['navigation filtered by permissions', app.includes('navigation.filter((item) => canAccess(item.label, user))')],
  ['unauthorized workspace blocked', app.includes('Access restricted')],
  ['role permissions sourced from authenticated profile', app.includes('permissions?: string[]')],
  ['retail POS permission mapped', app.includes("'Retail POS': ['retail:billing'")],
  ['bar POS permission mapped', app.includes("'Bar POS': ['bar:billing'")],
  ['finance permission mapped', app.includes("'Finance & Accounting': ['finance:read'")],
  ['offline reconciliation permission mapped', app.includes("'Offline Reconciliation': ['offline:read'")],
  ['permission helper uses exact match', policy.includes('granted.has(permission)')],
  ['empty permission list is denied', policy.includes('if (!required.length) return false')],
  ['auth profile refreshed after token change', app.includes('setAuthChecked(false);\n    fetch')],
  ['server authorization remains mandatory', policy.includes('API remains the security boundary')]
];
let failed = 0;
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++; }
console.log(`P548 static checks: ${checks.length - failed}/${checks.length} PASS`);
if (failed) process.exit(1);
