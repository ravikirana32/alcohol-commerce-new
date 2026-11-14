import fs from 'node:fs';
const route=fs.readFileSync('apps/api/src/routes/offlineValidation.ts','utf8');
const migration=fs.readFileSync('apps/api/src/db/226_p527_offline_event_validation.sql','utf8');
const app=fs.readFileSync('apps/api/src/app.ts','utf8');
const ui=fs.readFileSync('apps/web/src/components/OfflineReconciliationWorkspace.tsx','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const checks=[
 ['validation only after independent approval',route.includes("event.status !== 'APPROVED_NO_POST'")],
 ['sale and bar payload checks',route.includes("type === 'RETAIL_SALE'")&&route.includes("type === 'BAR_CHECKOUT'")&&route.includes('totalMinor')&&route.includes('payments')],
 ['stock adjustment payload checks',route.includes('quantityDelta')&&route.includes('productId')],
 ['diagnostic events excluded from ledger intent',route.includes("event.event_type !== 'DEVICE_DIAGNOSTIC'")],
 ['immutable validation evidence',migration.includes('UNIQUE(event_row_id)')&&route.includes('VALIDATION_ALREADY_RECORDED')],
 ['durable idempotent posting intent',migration.includes('UNIQUE(event_row_id)')&&route.includes('ON CONFLICT(event_row_id) DO NOTHING')],
 ['organisation scoped intents',route.includes('i.organisation_id=$1')&&migration.includes('organisation_id UUID NOT NULL')],
 ['event status transitions to ready or failed',route.includes("'READY_FOR_POST'")&&route.includes("'VALIDATION_FAILED'")],
 ['audit records validation result',route.includes('VALIDATION_RESULT')&&migration.includes('VALIDATION_RESULT')],
 ['ledger posting explicitly not executed',route.includes("ledgerPosting: 'NOT_EXECUTED'")],
 ['validation router mounted',app.includes("app.use('/api/v1', offlineValidationRouter)")],
 ['operator validation UI and intent list',ui.includes('validate(eventId')&&ui.includes('/offline/posting-intents')],
 ['release version bumped',pkg.version==='0.529.0-dev']
];
for(const [name,ok] of checks) console.log(`${ok?'PASS':'FAIL'} ${name}`);
const failed=checks.filter(x=>!x[1]).length;console.log(`P527 static acceptance: ${checks.length-failed}/${checks.length}`);if(failed)process.exit(1);
