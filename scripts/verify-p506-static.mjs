import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let failed=0;
try{const s=await fs.readFile(path.join(root,"scripts/verify-p506.mjs"),'utf8');const ok=["/api/health/live", "/api/health/ready"].every(t=>s.includes(t));console.log((ok?'PASS ':'FAIL ')+"API health probes");if(!ok)failed++}catch(e){console.log('FAIL '+"API health probes"+' '+e.message);failed++}
try{const s=await fs.readFile(path.join(root,"scripts/verify-p506.mjs"),'utf8');const ok=["/api/tenant", "401,403"].every(t=>s.includes(t));console.log((ok?'PASS ':'FAIL ')+"tenant boundary probe");if(!ok)failed++}catch(e){console.log('FAIL '+"tenant boundary probe"+' '+e.message);failed++}
try{const s=await fs.readFile(path.join(root,"docker-compose.yml"),'utf8');const ok=["PAYMENT_LIVE_MODE: \"false\"", "OFFLINE_SYNC_ENABLED: \"false\""].every(t=>s.includes(t));console.log((ok?'PASS ':'FAIL ')+"live features disabled");if(!ok)failed++}catch(e){console.log('FAIL '+"live features disabled"+' '+e.message);failed++}
console.log('P506 static checks: '+(failed?'FAIL':'PASS')+' ('+failed+' failures)');
process.exitCode=failed?1:0;
