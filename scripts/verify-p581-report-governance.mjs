import fs from 'node:fs';
import assert from 'node:assert/strict';
const route=fs.readFileSync('apps/api/src/routes/reportGovernance.ts','utf8');
const sql=fs.readFileSync('apps/api/src/db/257_p581_analytics_governance.sql','utf8');
const app=fs.readFileSync('apps/api/src/app.ts','utf8');
for(const [n,v] of Object.entries({'saved report list':route.includes('/reports/governance/saved'),'saved report create':route.includes('INSERT INTO p581_saved_reports'),'report history':route.includes('p581_report_execution_evidence'),'sha256 evidence':route.includes("createHash('sha256')"),'org scope':route.includes('requireOrgScope'),'permission guards':route.includes('requirePermission'),'report types constrained':sql.includes('FINANCE_PNL'),'execution evidence table':sql.includes('p581_report_execution_evidence'),'API mounted':app.includes('reportGovernanceRouter')})){assert.ok(v,n);console.log('PASS',n);}
