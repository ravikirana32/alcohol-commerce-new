import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let failed=0;
try{const s=await fs.readFile(path.join(root,"P512-GO-LIVE-GATES.md"),'utf8');const ok=["Karnataka excise", "penetration test", "outlet licences"].every(t=>s.includes(t));console.log((ok?'PASS ':'FAIL ')+"go-live gates document");if(!ok)failed++}catch(e){console.log('FAIL '+"go-live gates document"+' '+e.message);failed++}
try{const s=await fs.readFile(path.join(root,"P512-RELEASE-GATE.json"),'utf8');const ok=["\"release_status\": \"NOT_APPROVED\"", "\"production_enabled\": false", "\"live_payments_enabled\": false"].every(t=>s.includes(t));console.log((ok?'PASS ':'FAIL ')+"release gate defaults closed");if(!ok)failed++}catch(e){console.log('FAIL '+"release gate defaults closed"+' '+e.message);failed++}
try{const s=await fs.readFile(path.join(root,"scripts/verify-p512-gates.mjs"),'utf8');const ok=["approval still NOT_GRANTED"].every(t=>s.includes(t));console.log((ok?'PASS ':'FAIL ')+"approval script preserves closed status");if(!ok)failed++}catch(e){console.log('FAIL '+"approval script preserves closed status"+' '+e.message);failed++}
console.log('P512 static checks: '+(failed?'FAIL':'PASS')+' ('+failed+' failures)');
process.exitCode=failed?1:0;
