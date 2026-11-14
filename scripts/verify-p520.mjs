import fs from 'node:fs';import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(p,'utf8');
const m=read('apps/api/src/db/222_p520_payment_reconciliation.sql'),r=read('apps/api/src/routes/paymentReconciliation.ts'),a=read('apps/api/src/app.ts');
const checks=[
['batch schema is organisation/outlet scoped',m.includes('organisation_id UUID NOT NULL')&&m.includes('outlet_id UUID NOT NULL')],
['batch lifecycle constrained',m.includes("'OPEN','RECONCILED','CLOSED'")],
['statement lines constrain tender methods and amounts',m.includes("'UPI','CARD','WALLET','OTHER'")&&m.includes('amount NUMERIC(14,2) NOT NULL CHECK(amount > 0)')],
['provider transaction ids are unique per batch',m.includes('UNIQUE(batch_id,provider_transaction_id)')],
['reconciliation permission seeded for owner and manager',m.includes("'RETAIL_OWNER','payments:reconcile'")&&m.includes("'BAR_MANAGER','payments:reconcile'")],
['statement import validates outlet organisation scope',r.includes('OUTLET_NOT_FOUND')&&r.includes('outletId')],
['duplicate provider transaction imports are detected',r.includes("'DUPLICATE'")&&r.includes('Provider transaction already imported')],
['matching is scoped by organisation and outlet',r.includes('p.organisation_id=$1')&&r.includes('s.outlet_id=$2')&&r.includes('t.outlet_id=$2')],
['matching requires exact method, reference and amount',r.includes('p.reference=$3')&&r.includes('p.method=$4')&&r.includes('ABS(p.amount-$5)<0.005')],
['ambiguous matches become exceptions',r.includes("status='MISMATCH'")&&r.includes('Multiple matching captured payments')],
['batch only reconciles without unmatched or exception lines',r.includes("counts.rows[0].unmatched===0&&counts.rows[0].exceptions===0")],
['router mounted in API app',a.includes("import { paymentReconciliationRouter }")&&a.includes('app.use(\'/api/v1\', paymentReconciliationRouter)')],
];for(const [n,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${n}`);assert.ok(ok,n);}console.log(`P520 static acceptance: PASS (${checks.length}/${checks.length})`);
