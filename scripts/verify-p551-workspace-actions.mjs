import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const checks = [];
const ok = (name, condition) => checks.push({ name, ok: Boolean(condition) });
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const policy = read('apps/web/src/actionPermissions.ts');
const matrix = JSON.parse(read('apps/api/src/authz/permission-matrix.generated.json'));
const files = {
  'apps/web/src/components/CatalogueWorkspace.tsx': ['catalogue.manage'],
  'apps/web/src/components/OrganisationWorkspace.tsx': ['organisation.manage', 'outlet.manage', 'compliance.manage', 'users.manage'],
  'apps/web/src/components/ExciseComplianceWorkspace.tsx': ['compliance.manage', 'compliance.review', 'compliance.conditions.manage', 'compliance.drydays.manage', 'compliance.activate'],
  'apps/web/src/components/TaxPricingWorkspace.tsx': ['tax.manage', 'tax.review', 'tax.activate'],
  'apps/web/src/components/OfflineDeviceWorkspace.tsx': ['devices.manage'],
  'apps/web/src/components/OfflineReconciliationWorkspace.tsx': ['offline.authoritative', 'offline.validate', 'offline.review', 'offline.posting.approve', 'offline.ledger.post'],
  'apps/web/src/components/OfflineRecoveryWorkspace.tsx': ['offline.recovery.manage', 'offline.recovery.compensate'],
  'apps/web/src/components/TradePortalWorkspace.tsx': ['trade.manage'],
  'apps/web/src/components/ReportsWorkspace.tsx': ['reports.export'],
  'apps/web/src/components/BarServiceWorkspace.tsx': ['bar.manage'],
  'apps/web/src/components/ShiftWorkspace.tsx': ['shift.manage'],
};
const declared = new Set([...policy.matchAll(/^\s*'([^']+)'\s*:/gm)].map((m) => m[1]));
const allPermissions = [...policy.matchAll(/:\s*\[([^\]]*)\]/g)].flatMap((m) => [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]));
ok('All action policy permissions exist in migration-derived catalogue', allPermissions.every((permission) => matrix.permissionCatalog.includes(permission)));
ok('No duplicate action keys in central policy', declared.size === [...policy.matchAll(/^\s*'([^']+)'\s*:/gm)].length);
let guarded = 0;
for (const [file, actions] of Object.entries(files)) {
  const source = read(file);
  ok(`${file} imports ActionGuard`, /import\s*\{\s*ActionGuard\s*\}\s*from\s*['"]\.\.\/ActionGuard['"]/.test(source));
  for (const action of actions) {
    const count = source.split(`action="${action}"`).length - 1;
    guarded += count;
    ok(`${file} applies ${action}`, count > 0 && declared.has(action));
  }
}
const guard = read('apps/web/src/ActionGuard.tsx');
const app = read('apps/web/src/App.tsx');
ok('Guard context is wired to authenticated permission array', /permissions=\{user\.permissions\s*\?\?\s*\[\]\}/.test(app) && /PermissionProvider/.test(app));
ok('Guard defaults to deny/hide', /fallback\s*=\s*null/.test(guard));
ok('Exact permission matching remains in policy helper', /granted\.has\(permission\)/.test(read('apps/web/src/actionPermissions.ts')));
ok('Backend authorization middleware remains present', fs.existsSync(path.join(root, 'apps/api/src/middleware/requirePermission.ts')));
ok('No role-name or wildcard inference introduced', !/roleCode|isPlatformAdmin/.test(guard + policy) && !/['"]\*['"]/.test(policy));
const failures = checks.filter((item) => !item.ok);
for (const item of checks) console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.name}`);
console.log(`P551 workspace authorization: ${checks.length - failures.length}/${checks.length} PASS; ${guarded} permission guard bindings inspected`);
if (failures.length) process.exit(1);
