import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const dbDir = path.join(root, 'apps/api/src/db');
const grants = new Map();
const add = (role, permission) => {
  if (!/^[A-Z][A-Z0-9_]*$/.test(role) || !/^[a-z][a-z0-9:_-]*$/.test(permission)) return;
  if (!grants.has(role)) grants.set(role, new Set());
  grants.get(role).add(permission);
};
for (const file of fs.readdirSync(dbDir).filter((name) => name.endsWith('.sql')).sort()) {
  const sql = fs.readFileSync(path.join(dbDir, file), 'utf8');
  for (const match of sql.matchAll(/\(\s*'([A-Z][A-Z0-9_]*)'\s*,\s*'([a-z][a-z0-9:_-]*)'\s*\)/g)) add(match[1], match[2]);
  const dynamicInsert = /SELECT\s+role_code\s*,\s*'([a-z][a-z0-9:_-]*)'\s+FROM\s+\(VALUES\s+([\s\S]*?)\)\s+AS\s+roles\(role_code\)/gi;
  for (const match of sql.matchAll(dynamicInsert)) {
    const permission = match[1];
    for (const role of match[2].matchAll(/\(\s*'([A-Z][A-Z0-9_]*)'\s*\)/g)) add(role[1], permission);
  }
}
const matrix = {
  source: 'apps/api/src/db/*.sql role_permissions inserts (literal VALUES and SELECT role_code FROM VALUES grants)',
  roles: Object.fromEntries([...grants.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([role, permissions]) => [role, [...permissions].sort()])),
  permissionCatalog: [...new Set([...grants.values()].flatMap((set) => [...set]))].sort()
};
fs.writeFileSync(path.join(root, 'apps/api/src/authz/permission-matrix.generated.json'), `${JSON.stringify(matrix, null, 2)}\n`);
console.log(`Generated ${Object.keys(matrix.roles).length} roles and ${matrix.permissionCatalog.length} permissions from SQL migrations.`);
