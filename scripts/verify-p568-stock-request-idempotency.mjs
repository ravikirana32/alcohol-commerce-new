import fs from 'node:fs';
const read=(p)=>fs.readFileSync(p,'utf8');
const ops=read('apps/api/src/routes/operations.ts');
const proc=read('apps/api/src/routes/procurement.ts');
const migration=read('apps/api/src/db/244_p568_goods_receipt_request_idempotency.sql');
const checks=[
 ['manual receipt requires a bounded Idempotency-Key',/inventory\/receipts[\s\S]*?Idempotency-Key[\s\S]*?manual-receipt:\$\{key\}/.test(ops)],
 ['manual receipt increments balance only on newly-created movement',/if\(movement\.created\) await client\.query\(`INSERT INTO stock_balances/.test(ops)],
 ['manual adjustment includes signed delta in fingerprint and only applies once',/notes:`\$\{d\.reason\};delta:\$\{d\.delta\}`[\s\S]*?if\(!movement\.created\)[\s\S]*?const next=current\+d\.delta/.test(ops)],
 ['open bottle uses stable request identity and returns original bottle on replay',/open-bottle:\$\{key\}[\s\S]*?SELECT \* FROM open_bottles WHERE source_movement_id=\$1/.test(ops)],
 ['goods receipt requires request idempotency header',/Idempotency-Key[\s\S]*?goods-receipt:\$\{requestKey\}/.test(proc)],
 ['goods receipt compares payload fingerprint before mutations',/request_fingerprint!==fingerprint[\s\S]*?return res\.status\(200\)/.test(proc)],
 ['goods receipt persists request key and fingerprint',/idempotency_key,request_fingerprint/.test(proc)],
 ['goods receipt key is unique per organisation and outlet',/UNIQUE INDEX IF NOT EXISTS uq_goods_receipts_org_outlet_idempotency[\s\S]*?organisation_id,outlet_id,idempotency_key/.test(migration)],
 ['legacy goods receipts remain compatible through nullable idempotency columns',/ADD COLUMN IF NOT EXISTS idempotency_key TEXT[\s\S]*?ADD COLUMN IF NOT EXISTS request_fingerprint TEXT/.test(migration)],
 ['all three manual stock movement direct inserts removed from operations route',!/INSERT INTO stock_movements/.test(ops)]
];
let failed=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++;}
console.log(`${checks.length-failed}/${checks.length} checks passed`);if(failed)process.exit(1);
