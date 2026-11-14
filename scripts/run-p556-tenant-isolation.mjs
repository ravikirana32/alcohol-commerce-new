const base = (process.env.API_BASE_URL ?? '').replace(/\/$/, '');
const credentials = process.env.P555_ROLE_CREDENTIALS_JSON;
const casesRaw = process.env.P556_TENANT_CASES_JSON;
if (!base || !credentials || !casesRaw) {
  console.error('P556 runtime tests NOT RUN: configure API_BASE_URL, P555_ROLE_CREDENTIALS_JSON and P556_TENANT_CASES_JSON. No requests sent.');
  process.exit(2);
}
const roleCredentials = JSON.parse(credentials);
const cases = JSON.parse(casesRaw);
if (!Array.isArray(cases) || cases.length === 0) throw new Error('P556_TENANT_CASES_JSON must be a non-empty array');
const tokens = new Map();
async function login(role) {
  if (tokens.has(role)) return tokens.get(role);
  const c = roleCredentials[role];
  if (!c?.email || !c?.password) throw new Error(`Missing credentials for role ${role}`);
  const response = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: c.email, password: c.password, ...(c.organisationId ? { organisationId: c.organisationId } : {}) }) });
  if (!response.ok) throw new Error(`Login failed for ${role}: HTTP ${response.status}; response body suppressed`);
  const body = await response.json();
  const token = body?.data?.accessToken;
  if (!token) throw new Error(`Login response for ${role} omitted accessToken`);
  tokens.set(role, token);
  return token;
}
let passed = 0;
for (const item of cases) {
  if (!roleCredentials[item.role]) throw new Error(`Unknown or unconfigured role ${item.role}`);
  if (!['GET', 'HEAD'].includes(String(item.method ?? 'GET').toUpperCase())) throw new Error('P556 permits GET/HEAD only; use disposable isolated test fixtures for mutations');
  if (!String(item.path ?? '').startsWith('/')) throw new Error('Each P556 case requires an absolute API path');
  if (![403, 404].includes(item.expectedStatus)) throw new Error('Tenant-boundary negative cases must expect 403 or 404');
  if (item.boundary === 'cross-organisation' && (!item.actorOrganisationId || !item.resourceOrganisationId || item.actorOrganisationId === item.resourceOrganisationId)) throw new Error('Cross-organisation case requires distinct actor/resource organisation fixture IDs');
  if (item.boundary === 'cross-outlet' && (!item.actorOutletId || !item.resourceOutletId || item.actorOutletId === item.resourceOutletId)) throw new Error('Cross-outlet case requires distinct actor/resource outlet fixture IDs');
  if (!['cross-organisation', 'cross-outlet', 'foreign-resource'].includes(item.boundary)) throw new Error(`Unsupported boundary type ${item.boundary}`);
  const token = await login(item.role);
  const headers = { authorization: `Bearer ${token}`, accept: 'application/json', ...(item.headers ?? {}) };
  const response = await fetch(`${base}${item.path}`, { method: item.method ?? 'GET', headers });
  if (response.status !== item.expectedStatus) throw new Error(`${item.boundary} ${item.role} ${item.path}: expected ${item.expectedStatus}, got ${response.status}`);
  console.log(`PASS ${item.boundary} ${item.role} ${item.method ?? 'GET'} ${item.path} => ${response.status}`);
  passed++;
}
console.log(`P556 tenant isolation runtime matrix: ${passed} negative cases PASS`);
