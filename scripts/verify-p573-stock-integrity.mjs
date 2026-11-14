import fs from 'node:fs';
const root=new URL('../',import.meta.url).pathname;
const m=fs.readFileSync(root+'apps/api/src/db/249_p573_stock_integrity_constraints.sql','utf8');
const s=fs.readFileSync(root+'apps/api/src/services/stockReconciliation.ts','utf8');
const checks=[
 ['P573 cutoff uses wall-clock timestamp after outlet lock',fs.readFileSync(root+'apps/api/src/routes/operations.ts','utf8').includes('SELECT clock_timestamp() AS cutoff_at')],
 ['P573 persists reconciliation cutoff',m.includes('ledger_cutoff_at')],
 ['P573 links run to opening baseline',m.includes('baseline_snapshot_id')],
 ['P573 indexes unclassified legacy adjustments',m.includes('WHERE movement_type=\'ADJUSTMENT\' AND adjustment_direction IS NULL')],
 ['P573 indexes balance reconciliation scope',m.includes('idx_stock_balances_reconciliation')],
 ['Reconciliation retains signed adjustment semantics',s.includes("adjustment_direction='INCREASE'")&&s.includes("adjustment_direction='DECREASE'")],
 ['Legacy unsigned adjustments remain explicitly counted',s.includes('unclassified_adjustments')]
];
for(const [label,ok] of checks) console.log(`${ok?'PASS':'FAIL'} ${label}`);
if(checks.some(x=>!x[1])) process.exit(1);
console.log(`${checks.length}/${checks.length} P573 static checks passed`);
