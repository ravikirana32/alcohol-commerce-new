import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let failed=0;
try{const s=await fs.readFile(path.join(root,"docker-compose.yml"),'utf8');const ok=["OFFLINE_SYNC_ENABLED: \"false\""].every(t=>s.includes(t));console.log((ok?'PASS ':'FAIL ')+"offline flag disabled");if(!ok)failed++}catch(e){console.log('FAIL '+"offline flag disabled"+' '+e.message);failed++}
try{const s=await fs.readFile(path.join(root,"apps/api/src/services/offlineDedupe.ts"),'utf8');const ok=[""].every(t=>s.includes(t));console.log((ok?'PASS ':'FAIL ')+"idempotency service present");if(!ok)failed++}catch(e){console.log('FAIL '+"idempotency service present"+' '+e.message);failed++}
try{const s=await fs.readFile(path.join(root,"apps/api/src/services/offlineConflict.ts"),'utf8');const ok=[""].every(t=>s.includes(t));console.log((ok?'PASS ':'FAIL ')+"conflict service present");if(!ok)failed++}catch(e){console.log('FAIL '+"conflict service present"+' '+e.message);failed++}
try{const s=await fs.readFile(path.join(root,"apps/api/src/services/offlineEligibility.ts"),'utf8');const ok=[""].every(t=>s.includes(t));console.log((ok?'PASS ':'FAIL ')+"offline eligibility service present");if(!ok)failed++}catch(e){console.log('FAIL '+"offline eligibility service present"+' '+e.message);failed++}
console.log('P509 static checks: '+(failed?'FAIL':'PASS')+' ('+failed+' failures)');
process.exitCode=failed?1:0;
