import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const ops=read('apps/api/src/routes/operations.ts');
const bar=read('apps/api/src/routes/barCheckout.ts');
const offline=read('apps/api/src/routes/offlineLedgerPosting.ts');
const procurement=read('apps/api/src/routes/procurement.ts');
const checks=[
 ['retail checkout uses per-sale-line movement identity',/retail-sale:\$\{sale\.rows\[0\]\.id\}:line:\$\{lineIndex\}/.test(ops)],
 ['bar checkout uses per-ticket-line movement identity',/bar-ticket:\$\{ticketId\}:line:\$\{lineIndex\}/.test(bar)],
 ['offline retail posting uses source-event line identity',/offline-retail:\$\{intent\.source_event_id\}:line:\$\{index\}/.test(offline)],
 ['offline bar posting uses source-event line identity',/offline-bar:\$\{intent\.source_event_id\}:line:\$\{lineIndex\}/.test(offline)],
 ['transfer dispatch and receipt have separate stable identities',/stock-transfer:\$\{req\.params\.transferId\}:line:\$\{l\.id\}:out/.test(ops)&&/stock-transfer:\$\{req\.params\.transferId\}:line:\$\{l\.id\}:in/.test(ops)],
 ['stocktake approval movement uses stocktake line identity',/stocktake:\$\{req\.params\.stocktakeId\}:line:\$\{l\.id\}/.test(ops)],
 ['inventory batch receipt uses batch identity',/inventory-batch:\$\{b\.rows\[0\]\.id\}:receipt/.test(ops)],
 ['goods receipt uses persisted receipt-line identity',/goods-receipt:\$\{receipt\.rows\[0\]\.id\}:line:\$\{receiptLine\.rows\[0\]\.id\}/.test(procurement)],
 ['all integrated route files import append-once helper', [ops,bar,offline,procurement].every(s=>s.includes('import { appendStockMovementOnce }'))],
 ['manual receipt, adjustment and open-bottle direct writes removed', !/INSERT INTO stock_movements/.test(ops)]
];
let failed=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++;}
console.log(`${checks.length-failed}/${checks.length} checks passed`);if(failed)process.exit(1);
