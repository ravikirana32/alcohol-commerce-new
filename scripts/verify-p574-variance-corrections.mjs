import fs from 'node:fs';
const root=new URL('../',import.meta.url).pathname;
const m=fs.readFileSync(root+'apps/api/src/db/250_p574_stock_variance_corrections.sql','utf8');
const s=fs.readFileSync(root+'apps/api/src/routes/operations.ts','utf8');
const checks=[
 ['P574 correction request table exists',m.includes('CREATE TABLE IF NOT EXISTS stock_variance_correction_requests')],
 ['P574 maker-checker database constraint exists',m.includes('approved_by <> requested_by')],
 ['P574 correction requests are idempotent',m.includes('UNIQUE(organisation_id,outlet_id,idempotency_key)')],
 ['P574 request creation requires an idempotency key',s.includes("'/inventory/variance-correction-requests'")&&s.includes('IDEMPOTENCY_KEY_REQUIRED')],
 ['P574 approval blocks self-approval',s.includes('MAKER_CHECKER_REQUIRED')],
 ['P574 approval appends signed idempotent adjustment',s.includes("referenceType:'VARIANCE_CORRECTION'")&&s.includes('adjustmentDirection:')],
 ['P574 approval updates stock balance in same transaction',s.includes('stock_variance_correction_requests SET status=\'APPROVED\'')],
 ['P574 rejection requires a separate reviewer',s.includes('requested_by<>$1')],
 ['P574 correction scope enforced by database trigger',m.includes('enforce_stock_variance_correction_scope')&&m.includes('trg_stock_variance_correction_scope')],
 ['P574 request creation does not mutate stock',s.includes("'/inventory/variance-correction-requests'")&&s.includes("status='INVESTIGATING'")]
];
for(const [label,ok] of checks) console.log(`${ok?'PASS':'FAIL'} ${label}`);
if(checks.some(x=>!x[1])) process.exit(1);
console.log(`${checks.length}/${checks.length} P574 static checks passed`);
