import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let failed=0;
try{const s=await fs.readFile(path.join(root,"apps/api/src/db/216_p510_goods_receiving_three_way_match.sql"),'utf8');const ok=["CREATE TABLE IF NOT EXISTS goods_receipts"].every(t=>s.includes(t));console.log((ok?'PASS ':'FAIL ')+"GRN header schema");if(!ok)failed++}catch(e){console.log('FAIL '+"GRN header schema"+' '+e.message);failed++}
try{const s=await fs.readFile(path.join(root,"apps/api/src/db/216_p510_goods_receiving_three_way_match.sql"),'utf8');const ok=["accepted_units + rejected_units = received_units"].every(t=>s.includes(t));console.log((ok?'PASS ':'FAIL ')+"GRN line quantity constraints");if(!ok)failed++}catch(e){console.log('FAIL '+"GRN line quantity constraints"+' '+e.message);failed++}
try{const s=await fs.readFile(path.join(root,"apps/api/src/db/216_p510_goods_receiving_three_way_match.sql"),'utf8');const ok=["supplier_invoice_match_runs", "quantity_variance", "value_variance"].every(t=>s.includes(t));console.log((ok?'PASS ':'FAIL ')+"invoice matching schema");if(!ok)failed++}catch(e){console.log('FAIL '+"invoice matching schema"+' '+e.message);failed++}
try{const s=await fs.readFile(path.join(root,"apps/api/src/db/216_p510_goods_receiving_three_way_match.sql"),'utf8');const ok=["organisation_id UUID NOT NULL REFERENCES organisations"].every(t=>s.includes(t));console.log((ok?'PASS ':'FAIL ')+"tenant scoped records");if(!ok)failed++}catch(e){console.log('FAIL '+"tenant scoped records"+' '+e.message);failed++}
console.log('P510 static checks: '+(failed?'FAIL':'PASS')+' ('+failed+' failures)');
process.exitCode=failed?1:0;
