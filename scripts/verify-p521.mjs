import fs from 'node:fs';import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(p,'utf8');
const m=read('apps/api/src/db/223_p521_finance_accounting.sql'),r=read('apps/api/src/routes/finance.ts'),a=read('apps/api/src/app.ts');
const checks=[
['organisation-scoped chart of accounts',m.includes('organisation_id uuid NOT NULL')&&m.includes('UNIQUE (organisation_id, code)')],
['account types constrained',m.includes("'ASSET','LIABILITY','EQUITY','INCOME','EXPENSE'")],
['journals are organisation scoped',m.includes('finance_journals')&&m.includes('UNIQUE (organisation_id, journal_number)')],
['journal lines enforce one-sided debit/credit',m.includes('(debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)')],
['posted journal balance constraint trigger exists',m.includes('enforce_finance_journal_balance')&&m.includes('DEFERRABLE INITIALLY DEFERRED')],
['finance permissions seeded',m.includes("'RETAIL_OWNER','finance:view'")&&m.includes("'BAR_OWNER','finance:manage'")],
['finance routes require authentication and org scope',r.includes('financeRouter.use(authenticate, requireOrgScope)')],
['account creation validates parent organisation',r.includes('PARENT_ACCOUNT_NOT_FOUND')],
['journal posting checks balanced nonzero entries',r.includes('JOURNAL_NOT_BALANCED')],
['journal posting validates active organisation accounts',r.includes('INVALID_OR_INACTIVE_ACCOUNT')],
['journal persistence is transactional',r.includes("BEGIN")&&r.includes("COMMIT")&&r.includes("ROLLBACK")],
['trial balance filters posted journals by date',r.includes("j.status='POSTED'")&&r.includes('j.journal_date BETWEEN')],
['finance router mounted',a.includes("import { financeRouter }")&&a.includes("app.use('/api/v1', financeRouter)")]
];for(const [n,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${n}`);assert.ok(ok,n);}console.log(`P521 static acceptance: ${checks.length}/${checks.length}`);
