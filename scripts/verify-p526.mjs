import fs from 'node:fs';
const route=fs.readFileSync('apps/api/src/routes/offlineReconciliation.ts','utf8');
const intake=fs.readFileSync('apps/api/src/routes/offlineSync.ts','utf8');
const migration=fs.readFileSync('apps/api/src/db/225_p526_offline_reconciliation.sql','utf8');
const app=fs.readFileSync('apps/api/src/app.ts','utf8');
const ui=fs.readFileSync('apps/web/src/components/OfflineReconciliationWorkspace.tsx','utf8');
const web=fs.readFileSync('apps/web/src/App.tsx','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const checks=[
 ['submitter identity persisted',intake.includes('status,submitted_by')&&intake.includes('req.auth!.userId')],
 ['organisation-scoped review queue',route.includes("get('/offline/reconciliation/events'")&&route.includes('e.organisation_id=$1')],
 ['maker-checker self-review denied',route.includes('MAKER_CHECKER_REQUIRED')&&route.includes('event.submitted_by === req.auth!.userId')],
 ['mandatory decision reason',route.includes("min(8).max(500)")],
 ['transactional reviewer audit',route.includes('BEGIN')&&route.includes('RECONCILIATION_DECISION')&&route.includes('COMMIT')],
 ['conflicts cannot be approved',route.includes("event.status !== 'REVIEW_REQUIRED'")],
 ['approved state is non-posting',route.includes('APPROVED_NO_POST')&&route.includes('financialPosting: \'DISABLED\'')],
 ['reviewer columns and permission migration',migration.includes('reviewed_by')&&migration.includes("'offline:review'")],
 ['reconciliation router mounted',app.includes("app.use('/api/v1', offlineReconciliationRouter)")],
 ['operator review UI mounted',web.includes('<OfflineReconciliationWorkspace token={token!}/>')&&ui.includes('decide(eventId')],
 ['release version bumped',pkg.version==='0.529.0-dev']
];
for(const [name,ok] of checks) console.log(`${ok?'PASS':'FAIL'} ${name}`);
const failed=checks.filter(x=>!x[1]).length;console.log(`P526 static acceptance: ${checks.length-failed}/${checks.length}`);if(failed)process.exit(1);
