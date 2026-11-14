import fs from 'node:fs';
import path from 'node:path';

const root = 'apps/api/src/routes';
const files = fs.readdirSync(root).filter(f => f.endsWith('.ts')).sort();
const routePattern = /\b([A-Za-z_$][\w$]*)\.(get|post|put|patch|delete|head)\s*\(\s*(['\"])([^'\"]+)\3\s*,([\s\S]*?)=>/g;
const routes = [];
for (const file of files) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  let match;
  while ((match = routePattern.exec(source))) {
    const routerName = match[1];
    const routerUse = new RegExp(`${routerName}\\.use\\(([\\s\\S]*?)\\);`).exec(source)?.[1] ?? '';
    const middleware = `${routerUse} ${match[5].slice(0, 1400)}`;
    const permission = /requirePermission\s*\(/.test(middleware);
    const auth = /authenticate|requireAuth|requireSession|requirePlatformAdmin/.test(middleware);
    const scope = /require(?:Organisation|Organization|Org|Outlet|Tenant|Resource)[A-Za-z]*Scope|assert(?:Organisation|Organization|Org|Outlet|Tenant|Resource)[A-Za-z]*Access|tenantBoundary|permissionScope/.test(middleware);
    const pathValue = match[4];
    const identifiers = [...pathValue.matchAll(/:([A-Za-z][A-Za-z0-9_]*)/g)].map(x => x[1]);
    routes.push({ file, method: match[2].toUpperCase(), path: pathValue, permissionGuard: permission, authenticationGuard: auth, explicitScopeGuardInRouteDeclaration: scope, pathIdentifiers: identifiers, classification: scope ? 'explicit-scope-guard-visible' : permission || auth ? 'authz-present-scope-review-required' : 'manual-review-required' });
  }
}
const summary = {
  generatedAt: new Date().toISOString(),
  source: 'Static source scan of apps/api/src/routes/*.ts; not runtime proof',
  routeFilesScanned: files.length,
  routeDeclarationsFound: routes.length,
  withPermissionGuard: routes.filter(r => r.permissionGuard).length,
  withAuthenticationGuard: routes.filter(r => r.authenticationGuard).length,
  explicitScopeGuardVisible: routes.filter(r => r.explicitScopeGuardInRouteDeclaration).length,
  manualReviewRequired: routes.filter(r => r.classification === 'manual-review-required').length,
  pathIdentifierRoutes: routes.filter(r => r.pathIdentifiers.length).length,
  routes
};
fs.mkdirSync('reports', { recursive: true });
fs.writeFileSync('reports/P557-TENANT-ROUTE-COVERAGE.json', JSON.stringify(summary, null, 2) + '\n');
const lines = [
  '# P557 Tenant-Aware API Route Coverage', '',
  `- Route files scanned: ${summary.routeFilesScanned}`,
  `- Route declarations detected: ${summary.routeDeclarationsFound}`,
  `- Permission guard visible in declaration: ${summary.withPermissionGuard}`,
  `- Authentication guard visible in declaration: ${summary.withAuthenticationGuard}`,
  `- Explicit scope guard visible in declaration: ${summary.explicitScopeGuardVisible}`,
  `- Routes requiring manual scope review: ${summary.routeDeclarationsFound - summary.explicitScopeGuardVisible}`,
  `- Routes with path identifiers: ${summary.pathIdentifierRoutes}`, '',
  '> Static inventory only. A scope check may be implemented inside a handler, service, repository, SQL predicate, or inherited router middleware and therefore may not appear in this declaration scan. Conversely, a visible guard does not prove correct tenant isolation. Review source and execute authenticated negative tests.', '',
  '| Method | Route | File | Permission | Auth | Scope marker | Path IDs |',
  '|---|---|---|---:|---:|---:|---|',
  ...routes.map(r => `| ${r.method} | \`${r.path}\` | ${r.file} | ${r.permissionGuard ? 'yes' : 'no'} | ${r.authenticationGuard ? 'yes' : 'no'} | ${r.explicitScopeGuardInRouteDeclaration ? 'yes' : 'not visible'} | ${r.pathIdentifiers.join(', ') || '—'} |`), ''
];
fs.writeFileSync('doc-new/P557-TENANT-ROUTE-COVERAGE.md', lines.join('\n'));
console.log(`P557 route audit: ${routes.length} declarations in ${files.length} files; ${summary.explicitScopeGuardVisible} show explicit scope marker; ${summary.routeDeclarationsFound - summary.explicitScopeGuardVisible} require source-level review.`);
