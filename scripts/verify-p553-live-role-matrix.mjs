import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const matrixPath = path.join(root, 'apps/api/src/authz/permission-matrix.generated.json');
const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));
const expected = new Set();
for (const [role, permissions] of Object.entries(matrix.roles ?? {})) {
  for (const permission of permissions) expected.add(`${role}\u0000${permission}`);
}
if (!process.env.DATABASE_URL) {
  console.error('BLOCKED: DATABASE_URL is not set. No database connection was attempted.');
  console.error(`Expected ${expected.size} role-permission pairs across ${Object.keys(matrix.roles ?? {}).length} roles.`);
  process.exit(2);
}
let Client;
try { ({ Client } = await import('pg')); }
catch { console.error('BLOCKED: pg package is not installed in the current workspace.'); process.exit(2); }
const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000, statement_timeout: 10000, query_timeout: 10000, application_name: 'acp-p553-readonly-role-audit' });
try {
  await client.connect();
  await client.query('BEGIN READ ONLY');
  const result = await client.query('SELECT role_code, permission_code FROM role_permissions ORDER BY role_code, permission_code');
  const actual = new Set(result.rows.map((row) => `${row.role_code}\u0000${row.permission_code}`));
  const missing = [...expected].filter((pair) => !actual.has(pair)).map((pair) => pair.replace('\u0000', ' -> '));
  const extra = [...actual].filter((pair) => !expected.has(pair)).map((pair) => pair.replace('\u0000', ' -> '));
  await client.query('ROLLBACK');
  console.log(`Expected pairs: ${expected.size}; database pairs: ${actual.size}`);
  console.log(`Missing in database: ${missing.length}; extra in database: ${extra.length}`);
  for (const item of missing) console.log(`MISSING ${item}`);
  for (const item of extra) console.log(`EXTRA ${item}`);
  if (missing.length || extra.length) process.exitCode = 1;
  else console.log('PASS live role-permission matrix matches generated migration matrix');
} catch (error) {
  try { await client.query('ROLLBACK'); } catch {}
  console.error(`BLOCKED/ERROR: ${error.message}`);
  process.exitCode = 2;
} finally { await client.end().catch(() => {}); }
