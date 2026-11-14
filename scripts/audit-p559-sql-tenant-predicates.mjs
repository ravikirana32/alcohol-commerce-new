import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('apps/api/src');
const files=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(e.isFile()&&p.endsWith('.ts'))files.push(p);}}
walk(root);
const tablePattern=/\b(?:FROM|JOIN|UPDATE|INTO|DELETE\s+FROM)\s+([a-z_][a-z0-9_]*)/gi;
const tenantTable=/organisation_id|outlet_id/i;
const statements=[];
for(const file of files){const src=fs.readFileSync(file,'utf8');
  // Capture SQL template literals directly passed to query(); intentionally static-only.
  const re=/\.query\s*\(\s*`([\s\S]*?)`/g; let m;
  while((m=re.exec(src))){const sql=m[1];if(!/^\s*(SELECT|WITH|INSERT|UPDATE|DELETE)/i.test(sql))continue;
    const tables=[...sql.matchAll(tablePattern)].map(x=>x[1]);
    const unique=[...new Set(tables)];
    if(!unique.length)continue;
    const hasOrg=/\b(?:[a-z_][a-z0-9_]*\.)?organisation_id\s*=|\borganisation_id\s+IN\s*\(/i.test(sql);
    const hasOutlet=/\b(?:[a-z_][a-z0-9_]*\.)?outlet_id\s*=|\boutlet_id\s+IN\s*\(/i.test(sql);
    const isMutation=/^\s*(INSERT|UPDATE|DELETE)/i.test(sql);
    statements.push({file:path.relative(process.cwd(),file),line:src.slice(0,m.index).split('\n').length,tables:unique,hasOrganisationPredicate:hasOrg,hasOutletPredicate:hasOutlet,operation:(sql.match(/^\s*(SELECT|WITH|INSERT|UPDATE|DELETE)/i)?.[1]||'UNKNOWN').toUpperCase(),classification:hasOrg?'explicit-organisation-predicate':hasOutlet?'outlet-only-predicate':'manual-review-required',mutation:isMutation});
  }
}
const report={generatedAt:new Date().toISOString(),method:'Heuristic static scan of SQL template literals passed directly to .query(); does not resolve helper-built SQL, parameterized fragments, CTE semantics, joins, row-level security, or runtime query paths.',filesScanned:files.length,queryStatements:statements.length,explicitOrganisationPredicate:statements.filter(x=>x.hasOrganisationPredicate).length,outletPredicateOnly:statements.filter(x=>!x.hasOrganisationPredicate&&x.hasOutletPredicate).length,manualReviewRequired:statements.filter(x=>!x.hasOrganisationPredicate&&!x.hasOutletPredicate).length,mutationStatements:statements.filter(x=>x.mutation).length,statements};
fs.writeFileSync('P559-SQL-TENANT-PREDICATE-AUDIT.json',JSON.stringify(report,null,2)+'\n');
const md=['# P559 SQL Tenant Predicate Audit','',`- TypeScript files scanned: ${report.filesScanned}`,`- Direct query template literals inspected: ${report.queryStatements}`,`- Statements with explicit organisation predicate: ${report.explicitOrganisationPredicate}`,`- Outlet-only predicate: ${report.outletPredicateOnly}`,`- Manual review required: ${report.manualReviewRequired}`,`- Mutation statements: ${report.mutationStatements}`,'','## Method and limitations','',report.method,'','## Manual-review candidates',''];
for(const s of statements.filter(x=>x.classification==='manual-review-required').slice(0,250))md.push(`- [${s.operation} ${s.file}:${s.line} — tables: ${s.tables.join(', ')}`);
fs.writeFileSync('P559-SQL-TENANT-PREDICATE-AUDIT.md',md.join('\n')+'\n');
console.log(`P559 SQL audit: ${report.queryStatements} direct SQL templates across ${files.length} TypeScript files; ${report.manualReviewRequired} manual-review candidates.`);
