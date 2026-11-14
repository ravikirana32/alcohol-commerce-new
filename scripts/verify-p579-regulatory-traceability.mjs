import fs from 'node:fs';
const root=new URL('../',import.meta.url).pathname;
const migration=fs.readFileSync(root+'apps/api/src/db/255_p579_regulatory_traceability.sql','utf8');
const route=fs.readFileSync(root+'apps/api/src/routes/regulatoryReports.ts','utf8');
const app=fs.readFileSync(root+'apps/api/src/app.ts','utf8');
const checks={reportEvidenceTable:/CREATE TABLE IF NOT EXISTS p579_regulatory_report_runs/.test(migration),traceabilityTable:/CREATE TABLE IF NOT EXISTS p579_product_traceability_links/.test(migration),tenantScopedReport:/organisation_id=\$1/.test(route),immutableHash:/createHash\('sha256'\)/.test(route),reportTypes:['EXCISE_DECISIONS','LICENCE_STATUS','DRY_DAY_ORDERS','COMPLIANCE_EXCEPTIONS'].every(x=>route.includes(x)),sourceLinkIntegrity:/m\.product_id=p\.id/.test(route)&&/m\.quantity_units >= \$9/.test(route),appendOnlyEvidence:/p579_reject_evidence_mutation/.test(migration)&&/BEFORE UPDATE OR DELETE/.test(migration),permissionGates:/requirePermission\('compliance:reports:read'\)/.test(route)&&/requirePermission\('compliance:traceability:manage'\)/.test(route),mounted:/regulatoryReportsRouter/.test(app)};
for(const [k,v] of Object.entries(checks))console.log(`${v?'PASS':'FAIL'} ${k}`);
if(Object.values(checks).some(v=>!v))process.exit(1);
console.log(`P579 static verification: ${Object.values(checks).filter(Boolean).length}/${Object.keys(checks).length} PASS`);
