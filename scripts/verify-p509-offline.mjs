import fs from 'node:fs/promises';
const file='docker-compose.yml';const s=await fs.readFile(file,'utf8');let failed=0;
for(const [label,needle] of [['offline sync disabled by default','OFFLINE_SYNC_ENABLED: "false"'],['payments disabled by default','PAYMENT_LIVE_MODE: "false"']]){
 const ok=s.includes(needle);console.log(`${ok?'PASS':'FAIL'} ${label}`);if(!ok)failed++;
}
const services=['apps/api/src/services/offlineDedupe.ts','apps/api/src/services/offlineConflict.ts','apps/api/src/services/offlineEligibility.ts'];
for(const f of services){try{await fs.access(f);console.log(`PASS offline service present: ${f}`)}catch{console.log(`FAIL offline service missing: ${f}`);failed++}}
console.log(`P509 offline safety: ${failed?'FAIL':'PASS'} (${failed} failures)`);process.exitCode=failed?1:0;
