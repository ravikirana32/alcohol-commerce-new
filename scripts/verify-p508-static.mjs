import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let failed=0;
try{const s=await fs.readFile(path.join(root,"apps/api/src/app.ts"),'utf8');const ok=["helmet"].every(t=>s.includes(t));console.log((ok?'PASS ':'FAIL ')+"Helmet is installed");if(!ok)failed++}catch(e){console.log('FAIL '+"Helmet is installed"+' '+e.message);failed++}
try{const s=await fs.readFile(path.join(root,"apps/api/src/app.ts"),'utf8');const ok=["app.use(helmet"].every(t=>s.includes(t));console.log((ok?'PASS ':'FAIL ')+"API uses Helmet");if(!ok)failed++}catch(e){console.log('FAIL '+"API uses Helmet"+' '+e.message);failed++}
try{const s=await fs.readFile(path.join(root,"docker-compose.yml"),'utf8');const ok=["PAYMENT_LIVE_MODE: \"false\"", "OFFLINE_SYNC_ENABLED: \"false\""].every(t=>s.includes(t));console.log((ok?'PASS ':'FAIL ')+"local live modes disabled");if(!ok)failed++}catch(e){console.log('FAIL '+"local live modes disabled"+' '+e.message);failed++}
try{const s=await fs.readFile(path.join(root,"scripts/verify-p508-security.mjs"),'utf8');const ok=["content-security-policy", "x-powered-by"].every(t=>s.includes(t));console.log((ok?'PASS ':'FAIL ')+"security probe exists");if(!ok)failed++}catch(e){console.log('FAIL '+"security probe exists"+' '+e.message);failed++}
console.log('P508 static checks: '+(failed?'FAIL':'PASS')+' ('+failed+' failures)');
process.exitCode=failed?1:0;
