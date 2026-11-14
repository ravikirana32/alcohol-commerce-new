import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const settlements=read('apps/api/src/routes/settlements.ts');
const ecosystem=read('apps/api/src/routes/ecosystem.ts');
const migration=read('apps/api/src/db/245_p569_refund_request_idempotency.sql');
const stock=read('apps/api/src/services/stockMovementIdempotency.ts');
const checks=[
 ['retail refund requires bounded Idempotency-Key',/retail\/sales\/:saleId\/refunds[\s\S]*?refundKey\(req\)[\s\S]*?IDEMPOTENCY_KEY_REQUIRED/.test(settlements)],
 ['bar refund requires bounded Idempotency-Key',/bar\/tickets\/:ticketId\/refunds[\s\S]*?refundKey\(req\)[\s\S]*?IDEMPOTENCY_KEY_REQUIRED/.test(settlements)],
 ['retail refund replay checked before refund creation and balance effects',/SELECT \* FROM retail_refunds[\s\S]*?if\(replay\.rowCount\)[\s\S]*?INSERT INTO retail_refunds/.test(settlements)],
 ['bar refund replay checked before refund creation and peg quarantine effects',/SELECT \* FROM bar_refunds[\s\S]*?if\(replay\.rowCount\)[\s\S]*?INSERT INTO bar_refunds/.test(settlements)],
 ['payload mismatch is rejected with conflict response',/IDEMPOTENCY_KEY_CONFLICT/.test(settlements)&&/request_fingerprint!==fingerprint/.test(settlements)],
 ['refund restock ledger uses append-once helper',/appendStockMovementOnce\(client,[\s\S]*?retail-refund:\$\{createHash\('sha256'\)/.test(settlements)],
 ['refund movement and balance changes share transaction',/BEGIN[\s\S]*?INSERT INTO stock_balances[\s\S]*?appendStockMovementOnce/.test(settlements)],
 ['retail and bar refund tables have scoped unique keys',/uq_retail_refunds_org_outlet_idempotency/.test(migration)&&/uq_bar_refunds_org_outlet_idempotency/.test(migration)],
 ['transfer dispatch and receipt use append-once helper',/outlet-transfer:\$\{transferLine\.rows\[0\]\.id\}:out/.test(ecosystem)&&/outlet-transfer:\$\{line\.lineId\}:in/.test(ecosystem)],
 ['stock movement direct inserts are centralized in idempotency service',!/INSERT INTO stock_movements/.test(settlements+ecosystem)&&/INSERT INTO stock_movements/.test(stock)]
];
let failed=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++;}
console.log(`${checks.length-failed}/${checks.length} checks passed`);if(failed)process.exit(1);
