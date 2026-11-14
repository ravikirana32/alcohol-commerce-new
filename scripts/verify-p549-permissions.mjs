import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
const root = process.cwd();
const checks = [];
const ok = (name, condition) => checks.push({ name, ok: Boolean(condition) });
const dbDir = path.join(root, 'apps/api/src/db');
const pairs = new Set();
for (const file of fs.readdirSync(dbDir).filter((f) => f.endsWith('.sql'))) {
  const source = fs.readFileSync(path.join(dbDir, file), 'utf8');
  for (const match of source.matchAll(/\(\s*'([A-Z][A-Z0-9_]*)'\s*,\s*'([a-z][a-z0-9:_-]*)'\s*\)/g)) pairs.add(`${match[1]}|${match[2]}`);
}
const roles = {};
for (const pair of pairs) { const [role, permission] = pair.split('|'); (roles[role] ??= new Set()).add(permission); }
const catalog = new Set([...pairs].map((pair) => pair.split('|')[1]));
const app = fs.readFileSync(path.join(root, 'apps/web/src/App.tsx'), 'utf8');
const navBlock = app.match(/const navigationPermissions: Record<string, string\[]> = \{([\s\S]*?)\n\};/);
const navPermissions = [...(navBlock?.[1] ?? '').matchAll(/'([^']+)'\s*:\s*\[([^\]]*)\]/g)].flatMap((m) => [...m[2].matchAll(/'([^']+)'/g)].map((x) => ({ workspace: m[1], permission: x[1] })));
const actionSource = fs.readFileSync(path.join(root, 'apps/web/src/actionPermissions.ts'), 'utf8');
const actionPermissions = [...actionSource.matchAll(/'([^']+)'\s*:\s*\[([^\]]*)\]/g)].flatMap((m) => [...m[2].matchAll(/'([^']+)'/g)].map((x) => ({ action: m[1], permission: x[1] })));
const matrix = JSON.parse(fs.readFileSync(path.join(root, 'apps/api/src/authz/permission-matrix.generated.json'), 'utf8'));
const navJson = JSON.parse(fs.readFileSync(path.join(root, 'apps/web/src/permissionPolicy.generated.json'), 'utf8'));
ok('Role-permission matrix covers every role found in migrations', Object.keys(matrix.roles).length === Object.keys(roles).length && Object.keys(roles).every((r) => matrix.roles[r]));
ok('Generated matrix contains all migration permission codes', [...catalog].every((p) => matrix.permissionCatalog.includes(p)));
ok('Every frontend workspace permission exists in migration catalog', navPermissions.length > 0 && navPermissions.every((x) => catalog.has(x.permission)));
ok('Generated workspace policy mirrors App.tsx navigation policy', JSON.stringify(navJson.navigation) === JSON.stringify(Object.fromEntries(Object.entries(Object.fromEntries([...navBlock[1].matchAll(/'([^']+)'\s*:\s*\[([^\]]*)\]/g)].map(m=>[m[1],[...m[2].matchAll(/'([^']+)'/g)].map(x=>x[1])]))))));
ok('Every action-level permission exists in migration catalog', actionPermissions.length >= 20 && actionPermissions.every((x) => catalog.has(x.permission)));
ok('Action policy has no duplicate action keys', new Set(actionPermissions.map((x) => x.action)).size === new Set([...actionSource.matchAll(/^\s*'([^']+)'\s*:/gm)].map(m=>m[1])).size);
ok('Role matrix contains non-empty grants for each role', Object.values(matrix.roles).every((permissions) => permissions.length > 0));
ok('PLATFORM_ADMIN grant set is explicit (no wildcard grant)', (roles.PLATFORM_ADMIN ?? new Set()).size > 0 && ![...(roles.PLATFORM_ADMIN ?? [])].some((p) => p === '*' || p.endsWith(':*')));
ok('Frontend policy does not use role-name inference', !/roleCode\s*===|isPlatformAdmin\s*\?/.test(app.slice(app.indexOf('function canAccess'), app.indexOf('function App'))));
ok('Backend permission middleware remains authoritative', fs.existsSync(path.join(root, 'apps/api/src/middleware/requirePermission.ts')) && /permissions\.includes\(permission\)/.test(fs.readFileSync(path.join(root, 'apps/api/src/middleware/requirePermission.ts'), 'utf8')));
ok('Generated matrix records migration source', matrix.source.startsWith('apps/api/src/db/*.sql role_permissions inserts'));
const failures = checks.filter((c) => !c.ok);
for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'} ${c.name}`);
console.log(`P549 permission matrix checks: ${checks.length - failures.length}/${checks.length} PASS`);
if (failures.length) process.exit(1);
