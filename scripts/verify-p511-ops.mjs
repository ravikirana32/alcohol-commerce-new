import fs from 'node:fs/promises';let failed=0;
for(const [label,f,terms] of [
 ['backup script','scripts/db-backup.sh',['pg_dump']],
 ['restore script','scripts/db-restore.sh',['pg_restore']],
 ['health runbook','P511-OPERATIONS-RUNBOOK.md',['/api/health/live','/api/health/ready','Restore']],
 ['compose API healthcheck','docker-compose.yml',['/api/health/ready']]
]){try{const s=await fs.readFile(f,'utf8');const ok=terms.every(x=>s.includes(x));console.log(`${ok?'PASS':'FAIL'} ${label}`);if(!ok)failed++}catch(e){console.log(`FAIL ${label}: ${e.message}`);failed++}}
console.log(`P511 ops checks: ${failed?'FAIL':'PASS'} (${failed} failures)`);process.exitCode=failed?1:0;
