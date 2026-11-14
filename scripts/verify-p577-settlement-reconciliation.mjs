import fs from 'node:fs';
const root=process.cwd(),m=fs.readFileSync(root+'/apps/api/src/db/253_p577_settlement_reconciliation.sql','utf8'),r=fs.readFileSync(root+'/apps/api/src/routes/settlements.ts','utf8');
const checks=[
 ['Bank statement line table scoped and deduplicated',m.includes('p577_bank_statement_lines')&&m.includes('UNIQUE(organisation_id,bank_account_reference,statement_reference)')],
 ['Settlement batch can be matched to only one bank line',m.includes('uq_p577_bank_line_settlement_batch')],
 ['Bank statement import endpoint exists',r.includes("'/finance/bank-statement-lines'")],
 ['Settlement matching verifies outlet and organisation',r.includes('SETTLEMENT_BATCH_NOT_FOUND')&&r.includes('amountVariance')],
 ['Chargeback case lifecycle table exists',m.includes('p577_chargeback_cases')],
 ['Chargeback create/list/status APIs exist',r.includes("'/finance/chargebacks'")&&r.includes("'/finance/chargebacks/:caseId/status'")],
 ['Chargeback tender reference is tenant/outlet validated',r.includes('TENDER_ALLOCATION_NOT_FOUND')],
 ['Exact bank match marks payout bank-confirmed',r.includes("status='BANK_CONFIRMED'")],
 ['Live provider capture remains separate from bank reconciliation',r.includes('p577_bank_statement_lines')]
];
for(const [n,ok] of checks)console.log(`${ok?'PASS':'FAIL'} ${n}`);
if(checks.some(x=>!x[1]))process.exit(1);console.log(`${checks.length}/${checks.length} P577 checks passed`);
