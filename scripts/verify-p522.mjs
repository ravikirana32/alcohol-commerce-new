import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const route = fs.readFileSync(path.join(root,'apps/api/src/routes/analytics.ts'),'utf8');
const app = fs.readFileSync(path.join(root,'apps/api/src/app.ts'),'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const checks = [
  ['analytics router exists', route.includes("export const analyticsRouter = Router()")],
  ['authentication and organisation scope', route.includes('authenticate, requireOrgScope')],
  ['report permission enforced', route.includes("requirePermission('finance:view')")],
  ['date range validated', route.includes("z.string().date()") && route.includes("from must be on or before to")],
  ['outlet filter supported', route.includes('outletId')],
  ['overview endpoint', route.includes("'/reports/overview'")],
  ['sales trend endpoint', route.includes("'/reports/sales-trend'")],
  ['top products endpoint', route.includes("'/reports/top-products'")],
  ['inventory movements endpoint', route.includes("'/reports/inventory-movements'")],
  ['P&L endpoint', route.includes("'/reports/finance/profit-and-loss'")],
  ['tenant predicates present', (route.match(/organisation_id=\$1/g)||[]).length >= 8],
  ['analytics router mounted', app.includes("app.use('/api/v1', analyticsRouter)")],
  ['analytics import present', app.includes("from './routes/analytics.js'")],
  ['version bumped', pkg.version === '0.529.0-dev']
];
for (const [name,ok] of checks) console.log(`${ok?'PASS':'FAIL'} ${name}`);
const failed=checks.filter(x=>!x[1]).length;
console.log(`P522 static acceptance: ${checks.length-failed}/${checks.length}`);
if(failed) process.exit(1);
