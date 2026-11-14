import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const routesDir = path.join(root, 'apps/api/src/routes');
const routeFiles = fs.readdirSync(routesDir).filter((name) => name.endsWith('.ts')).sort();
const allowlist = {
  'health.ts|/live': 'Public liveness probe; no business data.',
  'health.ts|/ready': 'Operational readiness probe; no business data.',
  'capabilities.ts|/capabilities/phases': 'Public static capability metadata.',
  'platform.ts|/operating-modes': 'Public static operating-mode metadata; not a licence grant.',
  'auth.ts|/bootstrap': 'One-time bootstrap endpoint; implementation enforces bootstrap eligibility.',
  'auth.ts|/login': 'Credential exchange endpoint protected by rate limiting.',
  'paymentLifecycle.ts|/payments/provider-webhooks/:provider': 'Provider callback authenticated by webhook signature and replay controls.',
  'organisationAccess.ts|/organisation/invitations/accept': 'Invitation-token acceptance flow; token is the scoped credential.',
  'tenant.ts|/context': 'Authenticated self-context endpoint; returns only caller identity and grants.',
  'auth.ts|/me': 'Authenticated self-profile endpoint.',
  'auth.ts|/logout': 'Authenticated session revocation endpoint.'
};
const permissionCatalog = new Set(JSON.parse(fs.readFileSync(path.join(root, 'apps/api/src/authz/permission-matrix.generated.json'), 'utf8')).permissionCatalog);
const routes = [];
const checks = [];
const ok = (name, condition) => checks.push({ name, ok: Boolean(condition) });

for (const file of routeFiles) {
  const source = fs.readFileSync(path.join(routesDir, file), 'utf8');
  const inheritedByRouter = new Map();
  const routerUse = /([A-Za-z_$][\w$]*)\.use\(([\s\S]*?)\);/g;
  for (const match of source.matchAll(routerUse)) {
    const permissions = [...match[2].matchAll(/requirePermission\(\s*['"]([^'"]+)['"]\s*\)/g)].map((item) => item[1]);
    inheritedByRouter.set(match[1], permissions);
  }
  const routePattern = /([A-Za-z_$][\w$]*)\.(get|post|put|patch|delete|options|head)\(\s*(['"])([^'"]+)\3\s*,/g;
  for (const match of source.matchAll(routePattern)) {
    const start = match.index + match[0].length;
    const tail = source.slice(start, start + 1800);
    const callback = tail.search(/(?:async\s*)?\([^)]*\)\s*=>|\bfunction\s*\(/);
    const middlewareText = callback >= 0 ? tail.slice(0, callback) : tail.slice(0, 500);
    const direct = [...middlewareText.matchAll(/requirePermission\(\s*['"]([^'"]+)['"]\s*\)/g)].map((item) => item[1]);
    const inherited = inheritedByRouter.get(match[1]) ?? [];
    const permissions = [...new Set([...inherited, ...direct])];
    const exemption = allowlist[`${file}|${match[4]}`] ?? null;
    routes.push({ file, router: match[1], method: match[2].toUpperCase(), path: match[4], directPermissions: direct, inheritedPermissions: inherited, effectivePermissions: permissions, exemption });
  }
}

const protectedRoutes = routes.filter((route) => route.effectivePermissions.length > 0);
const exemptRoutes = routes.filter((route) => route.effectivePermissions.length === 0 && route.exemption);
const unclassified = routes.filter((route) => route.effectivePermissions.length === 0 && !route.exemption);
const unknownPermissions = [...new Set(routes.flatMap((route) => route.effectivePermissions))].filter((permission) => !permissionCatalog.has(permission));
const frontendPolicy = fs.readFileSync(path.join(root, 'apps/web/src/actionPermissions.ts'), 'utf8');
const frontendPermissions = [...new Set([...frontendPolicy.matchAll(/'([^']+)'/g)].map((match) => match[1]).filter((value) => value.includes(':')))];
const unknownFrontendPermissions = frontendPermissions.filter((permission) => !permissionCatalog.has(permission));

ok('Route inventory scanned at least 200 endpoint declarations', routes.length >= 200);
ok('Every route is permission-guarded or has an explicit reviewed exemption', unclassified.length === 0);
ok('Every backend route permission exists in migration-derived catalogue', unknownPermissions.length === 0);
ok('Every frontend action permission exists in migration-derived catalogue', unknownFrontendPermissions.length === 0);
ok('No wildcard permission grants appear in route policy', !routes.some((route) => route.effectivePermissions.includes('*')));
ok('No route has duplicate direct permission middleware', routes.every((route) => route.directPermissions.length === new Set(route.directPermissions).size));
ok('Public exemption list is explicit and non-empty', Object.keys(allowlist).length >= 10);
ok('Route records retain source file, method and path', routes.every((route) => route.file && route.method && route.path));

const report = {
  phase: 'P552',
  generatedAt: new Date().toISOString(),
  source: 'Static scan of apps/api/src/routes/*.ts and inherited Router.use middleware; not runtime proof.',
  summary: { routeDeclarations: routes.length, permissionGuardedRoutes: protectedRoutes.length, explicitlyExemptRoutes: exemptRoutes.length, unclassifiedRoutes: unclassified.length, distinctBackendPermissions: new Set(routes.flatMap((route) => route.effectivePermissions)).size },
  unknownPermissions,
  unknownFrontendPermissions,
  unclassifiedRoutes: unclassified,
  routes
};
const reportDirectory = path.join(root, 'reports');
fs.mkdirSync(reportDirectory, { recursive: true });
fs.writeFileSync(path.join(reportDirectory, 'P552-API-ROUTE-PERMISSION-MATRIX.json'), `${JSON.stringify(report, null, 2)}\n`);
for (const item of checks) console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.name}`);
if (unknownPermissions.length) console.log(`Unknown backend permissions: ${unknownPermissions.join(', ')}`);
if (unknownFrontendPermissions.length) console.log(`Unknown frontend permissions: ${unknownFrontendPermissions.join(', ')}`);
if (unclassified.length) console.log(`Unclassified routes: ${unclassified.map((route) => `${route.file}:${route.method} ${route.path}`).join('; ')}`);
console.log(`P552 API permission parity: ${checks.filter((item) => item.ok).length}/${checks.length} PASS; ${routes.length} routes scanned; ${protectedRoutes.length} guarded; ${exemptRoutes.length} explicitly exempt; ${unclassified.length} require review.`);
if (checks.some((item) => !item.ok)) process.exit(1);
