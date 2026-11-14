import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let failed=0;
try{const s=await fs.readFile(path.join(root,"playwright.config.ts"),'utf8');const ok=["@playwright/test", "retain-on-failure"].every(t=>s.includes(t));console.log((ok?'PASS ':'FAIL ')+"Playwright config");if(!ok)failed++}catch(e){console.log('FAIL '+"Playwright config"+' '+e.message);failed++}
try{const s=await fs.readFile(path.join(root,"tests/e2e/smoke.spec.ts"),'utf8');const ok=["POS web application loads", "API liveness is available"].every(t=>s.includes(t));console.log((ok?'PASS ':'FAIL ')+"web smoke spec");if(!ok)failed++}catch(e){console.log('FAIL '+"web smoke spec"+' '+e.message);failed++}
try{const s=await fs.readFile(path.join(root,"package.json"),'utf8');const ok=["test:e2e"].every(t=>s.includes(t));console.log((ok?'PASS ':'FAIL ')+"test script");if(!ok)failed++}catch(e){console.log('FAIL '+"test script"+' '+e.message);failed++}
console.log('P507 static checks: '+(failed?'FAIL':'PASS')+' ('+failed+' failures)');
process.exitCode=failed?1:0;
