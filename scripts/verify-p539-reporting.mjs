import fs from 'node:fs';import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url).pathname;
const app=fs.readFileSync(root+'apps/web/src/App.tsx','utf8');
const ui=fs.readFileSync(root+'apps/web/src/components/ReportsWorkspace.tsx','utf8');
const api=fs.readFileSync(root+'apps/api/src/routes/analytics.ts','utf8');
const checks=[
 ['Reports workspace mounted in application',app.includes('<ReportsWorkspace token={token!}/>')],
 ['Date range filters available',ui.includes('type="date"')],
 ['Overview API consumed',ui.includes('/api/v1/reports/overview')],
 ['Sales trend API consumed',ui.includes('/api/v1/reports/sales-trend')],
 ['Top products API consumed',ui.includes('/api/v1/reports/top-products')],
 ['CSV export escapes quotes',ui.includes('replaceAll')],
 ['CSV export uses generated Blob',ui.includes('new Blob([csv]')],
 ['API analytics remains permission-gated',api.includes("requirePermission('finance:view')")],
 ['Date range validated',api.includes("z.string().date()")],
 ['Sales basis caveat preserved',api.includes('not a substitute for posted accounting revenue')]
];
for(const [n,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${n}`);assert.ok(ok,n)}
console.log(`P539 static checks: ${checks.length}/${checks.length} PASS`);
