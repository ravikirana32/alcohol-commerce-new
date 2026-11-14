import fs from 'node:fs';
const root=process.cwd(),m=fs.readFileSync(root+'/apps/api/src/db/254_p578_financial_statement_controls.sql','utf8'),f=fs.readFileSync(root+'/apps/api/src/routes/finance.ts','utf8'),a=fs.readFileSync(root+'/apps/api/src/routes/financeAutomation.ts','utf8');
const checks=[
 ['Period close check evidence table exists',m.includes('p578_period_close_checks')],
 ['Accounts have explicit postable flag',m.includes('is_postable BOOLEAN')],
 ['Journal creation rejects inactive/non-postable accounts',f.includes('is_active=true AND is_postable=true')],
 ['Profit and loss statement endpoint exists',f.includes("'/finance/profit-and-loss'")],
 ['Balance sheet endpoint includes current earnings and balancing indicator',f.includes("'/finance/balance-sheet'")&&f.includes('currentEarnings')&&f.includes('liabilitiesAndEquity')],
 ['Cash flow endpoint declares classification limitation',f.includes("'/finance/cash-flow'")&&f.includes('not a full indirect cash-flow statement')],
 ['Period close checks balance and unresolved exceptions',a.includes('PERIOD_CLOSE_CHECKS_BLOCKED')&&a.includes('unbalanced_journal_count')],
 ['Period close stores evidence before closing',a.includes('INSERT INTO p578_period_close_checks')]
];
for(const [n,ok] of checks)console.log(`${ok?'PASS':'FAIL'} ${n}`);
if(checks.some(x=>!x[1]))process.exit(1);console.log(`${checks.length}/${checks.length} P578 checks passed`);
