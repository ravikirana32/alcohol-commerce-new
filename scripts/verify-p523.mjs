import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const route=fs.readFileSync(path.join(root,'apps/api/src/routes/tradePortal.ts'),'utf8');
const app=fs.readFileSync(path.join(root,'apps/api/src/app.ts'),'utf8');
const sql=fs.readFileSync(path.join(root,'apps/api/src/db/223_p523_trade_portals.sql'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const checks=[
 ['trade portal router exists',route.includes('export const tradePortalRouter = Router()')],
 ['authentication and tenant scope',route.includes('authenticate, requireOrgScope')],
 ['partner profile submission',route.includes("'/trade/profile'")],
 ['platform approval gate',route.includes("requirePermission('platform:manage')")],
 ['only active approved suppliers can be linked',route.includes("p.status='APPROVED'") && route.includes("o.status='ACTIVE'")],
 ['relationship buyer and supplier controls',route.includes("supplier_organisation_id=$4") && route.includes('buyer_organisation_id=$2')],
 ['trade catalogue requires active relationship',route.includes("status='ACTIVE'") && route.includes('TRADE_RELATIONSHIP_REQUIRED')],
 ['catalogue validates product ownership',route.includes('products WHERE id=$1 AND organisation_id=$2')],
 ['trade order validates minimum quantities',route.includes('BELOW_MINIMUM_ORDER')],
 ['trade order transactional create',route.includes('BEGIN') && route.includes('COMMIT')],
 ['order status transition rules',route.includes('INVALID_TRADE_ORDER_TRANSITION')],
 ['trade routes mounted',app.includes("app.use('/api/v1', tradePortalRouter)")],
 ['migration has partner/relationship/catalogue/order tables',['trade_partner_profiles','trade_relationships','trade_catalogue_items','trade_orders','trade_order_lines'].every(x=>sql.includes(x))],
 ['version bumped',pkg.version==='0.529.0-dev']
];
for(const [n,ok] of checks) console.log(`${ok?'PASS':'FAIL'} ${n}`);
const failed=checks.filter(x=>!x[1]).length;
console.log(`P523 static acceptance: ${checks.length-failed}/${checks.length}`);
if(failed)process.exit(1);
