import fs from 'node:fs/promises';
const d=JSON.parse(await fs.readFile('P512-RELEASE-GATE.json','utf8'));
const checks=[
 ['release is not approved',d.release_status==='NOT_APPROVED'],
 ['production remains disabled',d.production_enabled===false],
 ['live payments remain disabled',d.live_payments_enabled===false],
 ['offline sync remains disabled',d.offline_sync_enabled===false],
 ['consumer discovery remains disabled',d.consumer_discovery_enabled===false],
 ['three external approvals listed',d.mandatory_external_approvals.length===3],
 ['technical evidence required',d.evidence_required.length>=7]
];let failed=0;
for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++}
console.log(`P512 release gate: ${failed?'FAIL':'PASS'} (${failed} failures; approval still NOT_GRANTED)`);process.exitCode=failed?1:0;
