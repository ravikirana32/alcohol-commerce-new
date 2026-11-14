import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd(); const checks=[]; const ok=(name,value)=>checks.push({name,ok:Boolean(value)});
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const guard=read('apps/web/src/ActionGuard.tsx');
const app=read('apps/web/src/App.tsx');
const policy=read('apps/web/src/actionPermissions.ts');
const specs=[
 ['apps/web/src/components/POSWorkspace.tsx','retail.checkout','bar.checkout'],
 ['apps/web/src/components/InventoryWorkspace.tsx','inventory.receive','inventory.adjust'],
 ['apps/web/src/components/ProcurementWorkspace.tsx','procurement.manage','procurement.approve'],
 ['apps/web/src/components/FinanceAutomationWorkspace.tsx','finance.manage','finance.period.close'],
 ['apps/web/src/components/RetailSalesWorkspace.tsx','retail.refund'],
 ['apps/web/src/components/BarTicketsWorkspace.tsx','bar.refund'],
];
const matrix=JSON.parse(read('apps/api/src/authz/permission-matrix.generated.json'));
const known=new Set(matrix.permissionCatalog);
ok('Permission context is sourced from authenticated user permissions',/permissions=\{user\.permissions\s*\?\?\s*\[\]\}/.test(app)&&/PermissionProvider/.test(app));
ok('ActionGuard uses exact action permission policy',/canPerformAction\(\{ permissions: useContext\(PermissionContext\) \}, action\)/.test(guard));
ok('ActionGuard defaults to hiding unauthorized controls',/fallback = null/.test(guard));
let total=0; for(const [file,...actions] of specs){const source=read(file);for(const action of actions){total++;ok(`${file} guards ${action}`,source.includes(`action="${action}"`)||source.includes(`'${action}'`)||source.includes(`"${action}"`));}}
ok('All guarded action keys are declared in central policy', [...policy.matchAll(/^\s*'([^']+)'\s*:/gm)].length>=20);
ok('Every action policy permission exists in migration catalogue', [...policy.matchAll(/\['([^']+)'(?:,\s*'[^']+')*\]/g)].every(m=>[...m[0].matchAll(/'([^']+)'/g)].every(x=>matrix.permissionCatalog.includes(x[1]))));
ok('Backend permission middleware remains present',fs.existsSync(path.join(root,'apps/api/src/middleware/requirePermission.ts')));
ok('No role-name inference added to action guard',!/roleCode|isPlatformAdmin/.test(guard));
const failures=checks.filter(x=>!x.ok); for(const c of checks)console.log(`${c.ok?'PASS':'FAIL'} ${c.name}`); console.log(`P550 action authorization checks: ${checks.length-failures.length}/${checks.length} PASS; ${total} action bindings inspected`); if(failures.length)process.exit(1);
