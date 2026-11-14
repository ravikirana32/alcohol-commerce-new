import fs from 'node:fs';
import path from 'node:path';
const source=JSON.parse(fs.readFileSync('P559-SQL-TENANT-PREDICATE-AUDIT.json','utf8'));
const dbRoot='apps/api/src/db';
const migrationFiles=[];
function walk(dir){if(!fs.existsSync(dir))return;for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(/\.sql$/i.test(e.name))migrationFiles.push(p);}}
walk(dbRoot);
const schema=new Map();
for(const file of migrationFiles){const sql=fs.readFileSync(file,'utf8');const re=/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-z_][a-z0-9_]*)\s*\(([\s\S]*?)\)\s*;/gi;let m;while((m=re.exec(sql))){const cols=m[2];schema.set(m[1],{organisationId:/\borganisation_id\b/i.test(cols),outletId:/\boutlet_id\b/i.test(cols),migration:path.relative(process.cwd(),file)});}}
const globalTables=new Set(['role_permissions','permission_definitions','system_settings','schema_migrations']);
const noise=new Set(['SET','RETURNING','VALUES','SELECT','FROM','JOIN','WHERE','AS','ON','CONFLICT']);
const candidates=source.statements.filter(s=>s.classification==='manual-review-required'||s.classification==='outlet-only-predicate');
const rows=candidates.map(s=>{const tables=s.tables.filter(t=>!noise.has(t.toUpperCase()));const known=tables.map(t=>({table:t,...(schema.get(t)||{})}));let category='needs-manual-review';let rationale='No safe conclusion from static query text; inspect caller, joins, transaction context and schema constraints.';if(tables.length&&tables.every(t=>globalTables.has(t))){category='global-reference-or-auth';rationale='Table is in the explicit global/auth allowlist; confirm the query does not traverse a tenant-owned relation.';}else if(known.some(t=>t.organisationId||t.outletId)){category='tenant-bearing-table-review';rationale='At least one referenced table declares an organisation_id or outlet_id column; verify the predicate applies to every tenant-owned row and joined parent.';}else if(known.some(t=>!schema.has(t))){category='schema-unresolved';rationale='One or more table names were not resolved from CREATE TABLE statements; inspect dynamic/legacy schema and query construction.';}else if(tables.length){category='schema-without-obvious-scope-column';rationale='Known schema did not expose organisation_id/outlet_id in the captured CREATE TABLE block; verify parent ownership, composite foreign keys or global intent.';}
return {file:s.file,line:s.line,operation:s.operation,tables,mutation:s.mutation,category,rationale,schema:known.map(t=>({table:t.table,organisationId:!!t.organisationId,outletId:!!t.outletId,migration:t.migration||null}))};});
const counts=Object.fromEntries([...new Set(rows.map(r=>r.category))].sort().map(k=>[k,rows.filter(r=>r.category===k).length]));
const report={phase:'P560',generatedAt:new Date().toISOString(),inputAudit:'P559-SQL-TENANT-PREDICATE-AUDIT.json',migrationFilesScanned:migrationFiles.length,reviewCandidates:rows.length,counts,globalTableAllowlist:[...globalTables],method:'Conservative triage correlating P559 direct-query candidates with CREATE TABLE column declarations. This does not prove safe access, resolve CTE/join semantics, infer parent ownership, or cover helper-built/ORM SQL. No application SQL was modified.',items:rows};
fs.writeFileSync('P560-SQL-TRIAGE.json',JSON.stringify(report,null,2)+'\n');
const md=['# P560 SQL Candidate Triage','',`- Migration files scanned: ${report.migrationFilesScanned}`,`- P559 review candidates triaged: ${rows.length}`,...Object.entries(counts).map(([k,v])=>`- ${k}: ${v}`),'','## Method and safety','',report.method,'','## Triage categories','',...Object.entries(counts).map(([k,v])=>`- **${k} (${v})**`),'','## Candidate details',''];
for(const r of rows)md.push(`- **${r.category}** — ${r.operation} ${r.file}:${r.line}; tables: ${r.tables.join(', ')||'unresolved'}; ${r.rationale}`);
fs.writeFileSync('P560-SQL-TRIAGE.md',md.join('\n')+'\n');
console.log(`P560 triage: ${rows.length} candidates; ${Object.entries(counts).map(([k,v])=>`${k}=${v}`).join(', ')}`);
