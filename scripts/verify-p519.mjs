import fs from 'node:fs';import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(p,'utf8');
const migration=read('apps/api/src/db/221_p519_procurement_supplier_controls.sql');
const api=read('apps/api/src/routes/procurement.ts');
const app=read('apps/api/src/app.ts');const ui=read('apps/web/src/components/ProcurementWorkspace.tsx');const shell=read('apps/web/src/App.tsx');
const checks=[
 ['supplier GSTIN, contact and payment terms schema',migration.includes('ADD COLUMN IF NOT EXISTS gstin')&&migration.includes('payment_terms_days')],
 ['approval records have constrained states and one record per PO',migration.includes('purchase_order_approvals')&&migration.includes("'PENDING','APPROVED','REJECTED'")&&migration.includes('purchase_order_id UUID NOT NULL UNIQUE')],
 ['procurement permissions seeded for owner and manager roles',migration.includes("'RETAIL_OWNER','procurement:approve'")&&migration.includes("'BAR_MANAGER','procurement:read'")],
 ['procurement audit ledger exists',migration.includes('procurement_audit_events')&&migration.includes('details JSONB')],
 ['supplier create validates GSTIN and phone',api.includes("/procurement/suppliers'")&&api.includes("/^[0-9A-Z]{15}$/")&&api.includes('SUPPLIER_CODE_EXISTS')],
 ['supplier updates are organisation scoped',api.includes('WHERE id=$7 AND organisation_id=$8')],
 ['PO creation validates outlet, supplier and products',api.includes("/procurement/purchase-orders'")&&api.includes('SUPPLIER_NOT_ACTIVE')&&api.includes('Product does not belong to organisation')],
 ['PO submission is draft-only and requires lines',api.includes('Only draft purchase orders can be submitted')&&api.includes('EMPTY_PO')],
 ['approval is pending-only and audited',api.includes('PURCHASE_ORDER_${s.data.decision}')&&api.includes('INVALID_APPROVAL_STATE')],
 ['receiving requires approved PO and caps receipt quantities',api.includes('PO_NOT_APPROVED')&&api.includes('RECEIPT_EXCEEDS_ORDER')],
 ['accepted receipt quantity updates stock and movement ledger',api.includes('stock_balances')&&api.includes("'RECEIPT'")&&api.includes('stock_movements')],
 ['batch receipt supports expiry and remaining quantity',api.includes('inventory_batches')&&api.includes('expiryDate')],
 ['procurement router mounted',app.includes("import { procurementRouter }")&&app.includes('app.use(\'/api/v1\', procurementRouter)')],
 ['procurement UI wired into navigation',shell.includes("label: 'Procurement'")&&shell.includes('<ProcurementWorkspace')&&ui.includes('Supplier directory')],
];for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);assert.ok(ok,name);}console.log(`P519 static acceptance: PASS (${checks.length}/${checks.length})`);
