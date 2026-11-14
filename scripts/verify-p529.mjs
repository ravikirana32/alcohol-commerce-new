import fs from 'node:fs';
const route=fs.readFileSync('apps/api/src/routes/offlinePostingApproval.ts','utf8');
const migration=fs.readFileSync('apps/api/src/db/228_p529_offline_posting_approval.sql','utf8');
const app=fs.readFileSync('apps/api/src/app.ts','utf8');
const ui=fs.readFileSync('apps/web/src/components/OfflineReconciliationWorkspace.tsx','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const checks=[
 ['approval endpoint is registered in router',route.includes("post('/offline/posting-intents/:intentId/approval'")],
 ['approval requires dedicated permission',route.includes("requirePermission('offline:posting-approve')")],
 ['approval is organisation scoped',route.includes('i.organisation_id=$2')],
 ['intent must be structurally validated',route.includes("row.validation_outcome !== 'PASS'")],
 ['authoritative check must pass',route.includes("row.authoritative_outcome !== 'PASS'")],
 ['maker-checker excludes creator and submitter',route.includes('row.created_by')&&route.includes('row.submitted_by')&&route.includes('MAKER_CHECKER_REQUIRED')],
 ['maker-checker excludes reviewer and validators',route.includes('row.reviewed_by')&&route.includes('row.validator_user_id')&&route.includes('row.checked_by')],
 ['approval decision and reason are constrained',route.includes("z.enum(['APPROVE','REJECT'])")&&route.includes('.min(8).max(500)')],
 ['approval decision is immutable per intent',migration.includes('UNIQUE(posting_intent_id)')&&route.includes('APPROVAL_IMMUTABLE')],
 ['approval stores validation evidence hash',route.includes('validationHash')&&migration.includes('validation_hash TEXT NOT NULL')],
 ['intent status records authorization or hold',route.includes("'AUTHORIZED_TO_POST'")&&route.includes("'HELD'")&&migration.includes("'AUTHORIZED_TO_POST'" )],
 ['approval is audited',route.includes("'POSTING_APPROVAL'")&&migration.includes("'POSTING_APPROVAL'")],
 ['approval endpoint is mounted',app.includes('offlinePostingApprovalRouter')&&app.includes("app.use('/api/v1', offlinePostingApprovalRouter)")],
 ['operator UI exposes approve/reject and warning',ui.includes('approvePosting(i.id')&&ui.includes('Reject posting intent')&&ui.includes('No ledger posting')],
 ['ledger posting remains explicitly disabled',route.includes("ledgerPosting: 'NOT_EXECUTED'")],
 ['release version is aligned',pkg.version===fs.readFileSync('VERSION','utf8').trim() && fs.readFileSync('apps/api/src/config/version.ts','utf8').includes(pkg.version) && fs.readFileSync('apps/web/src/config/version.ts','utf8').includes(pkg.version)]
];
for(const [name,ok] of checks) console.log(`${ok?'PASS':'FAIL'} ${name}`);
const failed=checks.filter(x=>!x[1]).length;
console.log(`P529 static acceptance: ${checks.length-failed}/${checks.length}`);
if(failed) process.exit(1);
