import fs from 'node:fs';
const route=fs.readFileSync('apps/api/src/routes/offlineSync.ts','utf8');
const migration=fs.readFileSync('apps/api/src/db/224_p525_offline_sync_ledger.sql','utf8');
const app=fs.readFileSync('apps/api/src/app.ts','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const checks=[
 ['device enrolment endpoint',route.includes("post('/offline/devices'")],
 ['device revocation endpoint',route.includes("post('/offline/devices/:deviceId/revoke'")],
 ['sync batch intake endpoint',route.includes("post('/offline/sync-batches'")],
 ['bounded event count and payload',route.includes('.max(500)')&&route.includes('1024 * 1024')],
 ['batch idempotency with payload hash',route.includes('BATCH_ID_REUSE')&&route.includes('payload_hash')],
 ['per-device event and sequence uniqueness',migration.includes('UNIQUE(organisation_id,device_id,event_id)')&&migration.includes('UNIQUE(organisation_id,device_id,sequence_no)')],
 ['conflict audit trail',route.includes('EVENT_CONFLICT')&&migration.includes('offline_sync_audit')],
 ['financial posting disabled',route.includes("financialPosting: 'DISABLED'")&&migration.includes("DEFAULT 'REVIEW_REQUIRED'")],
 ['org/outlet/device scope enforced',route.includes('organisation_id=$2 AND outlet_id=$3')&&migration.includes('FOREIGN KEY(device_id,organisation_id,outlet_id)')],
 ['router mounted',app.includes("app.use('/api/v1', offlineSyncRouter)")],
 ['release version bumped',pkg.version==='0.529.0-dev']
];
for(const [name,ok] of checks) console.log(`${ok?'PASS':'FAIL'} ${name}`);
const failed=checks.filter(x=>!x[1]).length;console.log(`P525 static acceptance: ${checks.length-failed}/${checks.length}`);if(failed)process.exit(1);
