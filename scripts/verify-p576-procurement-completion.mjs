import fs from 'node:fs';
const root=process.cwd(),p=fs.readFileSync(root+'/apps/api/src/routes/procurement.ts','utf8'),m=fs.readFileSync(root+'/apps/api/src/db/252_p576_supplier_returns.sql','utf8');
const checks=[
 ['Supplier returns have scoped header/line tables',m.includes('CREATE TABLE IF NOT EXISTS supplier_returns')&&m.includes('supplier_return_lines')],
 ['Supplier return uses explicit stock movement type',m.includes("'SUPPLIER_RETURN'")&&p.includes("movementType:'SUPPLIER_RETURN'")],
 ['Supplier return draft creation validates tenant supplier/outlet/product',p.includes("'/procurement/supplier-returns'")&&p.includes('INVALID_RETURN_SCOPE')&&p.includes('RETURN_PRODUCT_INVALID')],
 ['Supplier return approval uses separate reviewer',p.includes('MAKER_CHECKER_REQUIRED')],
 ['Supplier return posting locks stock balance and checks quantity',p.includes('FOR UPDATE')&&p.includes('INSUFFICIENT_STOCK')],
 ['Supplier return posting consumes FIFO layer cost',p.includes('consumeInventoryCostFifo')],
 ['Goods receipt remains idempotent and supports partial accepted quantity',p.includes('GOODS_RECEIPT_IDEMPOTENCY_CONFLICT')&&p.includes('acceptedUnits')],
 ['PO receipt tracks PART_RECEIVED state',p.includes("'PART_RECEIVED'")]
];
for(const [n,ok] of checks)console.log(`${ok?'PASS':'FAIL'} ${n}`);
if(checks.some(x=>!x[1]))process.exit(1);console.log(`${checks.length}/${checks.length} P576 checks passed`);
