import fs from 'node:fs';
import path from 'node:path';

const base = (process.env.API_BASE_URL ?? '').replace(/\/$/, '');
const credentials = process.env.P555_ROLE_CREDENTIALS_JSON;
const casesRaw = process.env.P555_API_CASES_JSON;
if (!base || !credentials || !casesRaw) {
  console.error('P555 runtime test not run: configure API_BASE_URL, P555_ROLE_CREDENTIALS_JSON and P555_API_CASES_JSON. No requests were sent.');
  process.exit(2);
}
const matrixPath = path.resolve('apps/api/src/authz/permission-matrix.generated.json');
const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));
const roleCredentials = JSON.parse(credentials);
const cases = JSON.parse(casesRaw);
if (!Array.isArray(cases) || cases.length === 0) throw new Error('P555_API_CASES_JSON must be a non-empty array');
for (const item of cases) {
  if (!['GET', 'HEAD'].includes(String(item.method ?? 'GET').toUpperCase())) throw new Error('P555 only permits GET/HEAD routes to keep the harness non-destructive');
  if (!matrix.roles[item.role]) throw new Error(`Unknown role in test case: ${item.role}`);
  if (!matrix.roles[item.role].includes(item.permission) && item.expectedStatus !== 403) throw new Error(`Un-granted role ${item.role} must expect 403 for ${item.permission}`);
  if (matrix.roles[item.role].includes(item.permission) && item.expectedStatus !== 200) throw new Error(`Granted role ${item.role} must expect 200 for ${item.permission}`);
  if (!String(item.path ?? '').startsWith('/')) throw new Error('Each case path must be an absolute API path');
}
const tokens = new Map();
async function login(role) {
  if (tokens.has(role)) return tokens.get(role);
  const c = roleCredentials[role];
  if (!c?.email || !c?.password) throw new Error(`Missing credentials for role ${role}`);
  const response = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: c.email, password: c.password, ...(c.organisationId ? { organisationId: c.organisationId } : {}) }) });
  if (!response.ok) throw new Error(`Login failed for ${role}: HTTP ${response.status} (response body suppressed)`);
  const body = await response.json();
  const token = body?.data?.accessToken;
  if (!token) throw new Error(`Login response for ${role} did not contain accessToken`);
  tokens.set(role, token);
  return token;
}
let passed = 0;
for (const item of cases) {
  const token = await login(item.role);
  const response = await fetch(`${base}${item.path}`, { method: item.method ?? 'GET', headers: { authorization: `Bearer ${token}`, accept: 'application/json' } });
  const expected = item.expectedStatus;
  if (response.status !== expected) throw new Error(`${item.role} ${item.method ?? 'GET'} ${item.path} (${item.permission}): expected ${expected}, got ${response.status}`);
  if (expected === 403) {
    const body = await response.json().catch(() => ({}));
    if (body?.error?.code !== 'PERMISSION_DENIED') throw new Error(`${item.role} ${item.path}: expected PERMISSION_DENIED response code`);
  }
  console.log(`PASS ${item.role} ${item.method ?? 'GET'} ${item.path} => ${expected} (${item.permission})`);
  passed++;
}
// Verify server-side session revocation, not merely local token disposal.
const firstRole = cases[0].role;
const token = tokens.get(firstRole);
const logout = await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: { authorization: `Bearer ${token}` } });
if (logout.status !== 204) throw new Error(`Logout/session revocation expected 204, got ${logout.status}`);
const me = await fetch(`${base}/api/auth/me`, { headers: { authorization: `Bearer ${token}` } });
if (me.status !== 401) throw new Error(`Revoked session expected /auth/me 401, got ${me.status}`);
console.log(`PASS revoked session rejected by /api/auth/me (401)`);
console.log(`P555 authenticated API matrix: ${passed} route cases + session revocation PASS`);
