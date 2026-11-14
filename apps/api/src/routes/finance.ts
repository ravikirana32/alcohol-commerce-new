import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { requireOrgScope } from '../middleware/requireOrgScope.js';

export const financeRouter = Router();
financeRouter.use(authenticate, requireOrgScope);
const uuid = z.string().uuid();
const accountSchema = z.object({
  code: z.string().trim().min(2).max(32),
  name: z.string().trim().min(2).max(120),
  accountType: z.enum(['ASSET','LIABILITY','EQUITY','INCOME','EXPENSE']),
  parentId: uuid.optional()
});
const journalSchema = z.object({
  outletId: uuid.optional(),
  journalDate: z.string().date().optional(),
  sourceType: z.enum(['MANUAL','SALES','PURCHASE','REFUND','RECONCILIATION','OPENING']),
  sourceId: uuid.optional(),
  description: z.string().trim().min(3).max(500),
  lines: z.array(z.object({
    accountId: uuid,
    debit: z.number().min(0).default(0),
    credit: z.number().min(0).default(0),
    memo: z.string().max(300).optional()
  })).min(2).max(100)
});

financeRouter.get('/finance/accounts', requirePermission('finance:view'), async (req,res) => {
  const r=await pool.query(`SELECT id,code,name,account_type,parent_id,is_system,is_active
    FROM finance_accounts WHERE organisation_id=$1 ORDER BY code`,[req.auth!.organisationId]);
  return res.json({data:r.rows});
});
financeRouter.post('/finance/accounts', requirePermission('finance:manage'), async (req,res) => {
  const s=accountSchema.safeParse(req.body);
  if(!s.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:s.error.flatten()}});
  const org=req.auth!.organisationId!;
  if(s.data.parentId){
    const p=await pool.query('SELECT id FROM finance_accounts WHERE id=$1 AND organisation_id=$2',[s.data.parentId,org]);
    if(!p.rowCount)return res.status(404).json({error:{code:'PARENT_ACCOUNT_NOT_FOUND'}});
  }
  try{
    const r=await pool.query(`INSERT INTO finance_accounts(organisation_id,code,name,account_type,parent_id)
      VALUES($1,$2,$3,$4,$5) RETURNING *`,[org,s.data.code,s.data.name,s.data.accountType,s.data.parentId??null]);
    return res.status(201).json({data:r.rows[0]});
  }catch(e:any){if(e.code==='23505')return res.status(409).json({error:{code:'ACCOUNT_CODE_EXISTS'}});throw e;}
});
financeRouter.post('/finance/journals', requirePermission('finance:manage'), async (req,res) => {
  const s=journalSchema.safeParse(req.body);
  if(!s.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:s.error.flatten()}});
  const debit=s.data.lines.reduce((n,l)=>n+l.debit,0), credit=s.data.lines.reduce((n,l)=>n+l.credit,0);
  if(Math.abs(debit-credit)>0.005 || debit<=0 || s.data.lines.some(l=>(l.debit>0)===(l.credit>0)))
    return res.status(400).json({error:{code:'JOURNAL_NOT_BALANCED'}});
  const org=req.auth!.organisationId!, c=await pool.connect();
  try{
    await c.query('BEGIN');
    if(s.data.outletId){
      const o=await c.query('SELECT id FROM outlets WHERE id=$1 AND organisation_id=$2',[s.data.outletId,org]);
      if(!o.rowCount){await c.query('ROLLBACK');return res.status(404).json({error:{code:'OUTLET_NOT_FOUND'}});}
    }
    const ids=[...new Set(s.data.lines.map(l=>l.accountId))];
    const a=await c.query('SELECT id FROM finance_accounts WHERE organisation_id=$1 AND id=ANY($2::uuid[]) AND is_active=true AND is_postable=true',[org,ids]);
    if(a.rowCount!==ids.length){await c.query('ROLLBACK');return res.status(400).json({error:{code:'INVALID_OR_INACTIVE_ACCOUNT'}});}
    const number=`J-${Date.now()}-${Math.floor(Math.random()*10000)}`;
    const j=await c.query(`INSERT INTO finance_journals(organisation_id,outlet_id,journal_number,journal_date,source_type,source_id,description,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [org,s.data.outletId??null,number,s.data.journalDate??new Date().toISOString().slice(0,10),s.data.sourceType,s.data.sourceId??null,s.data.description,req.auth!.userId]);
    for(const l of s.data.lines) await c.query(`INSERT INTO finance_journal_lines(journal_id,organisation_id,account_id,debit,credit,memo)
      VALUES($1,$2,$3,$4,$5,$6)`,[j.rows[0].id,org,l.accountId,l.debit,l.credit,l.memo??null]);
    await c.query(`UPDATE finance_journals SET status='POSTED' WHERE id=$1 AND organisation_id=$2`,[j.rows[0].id,org]);
    await c.query('COMMIT');
    return res.status(201).json({data:{...j.rows[0],status:'POSTED',totalDebit:debit,totalCredit:credit}});
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
});
financeRouter.get('/finance/trial-balance', requirePermission('finance:view'), async(req,res)=>{
  const from=z.string().date().safeParse(req.query.from),to=z.string().date().safeParse(req.query.to);
  if(!from.success||!to.success||from.data>to.data)return res.status(400).json({error:{code:'INVALID_DATE_RANGE'}});
  const r=await pool.query(`SELECT a.id,a.code,a.name,a.account_type,
    COALESCE(SUM(l.debit),0)::numeric(14,2) debit,
    COALESCE(SUM(l.credit),0)::numeric(14,2) credit
    FROM finance_accounts a LEFT JOIN (
      SELECT jl.account_id,jl.organisation_id,jl.debit,jl.credit
      FROM finance_journal_lines jl JOIN finance_journals j ON j.id=jl.journal_id
      WHERE j.organisation_id=$1 AND j.status='POSTED' AND j.journal_date BETWEEN $2 AND $3
    ) l ON l.account_id=a.id AND l.organisation_id=a.organisation_id
    WHERE a.organisation_id=$1 GROUP BY a.id ORDER BY a.code`,
    [req.auth!.organisationId,from.data,to.data]);
  const rows=r.rows.map((x:any)=>({...x,debit:jNum(x.debit),credit:jNum(x.credit),net:Math.round((jNum(x.debit)-jNum(x.credit))*100)/100}));
  const totalDebit=rows.reduce((n:any,x:any)=>n+x.debit,0),totalCredit=rows.reduce((n:any,x:any)=>n+x.credit,0);
  return res.json({data:rows,totals:{debit:totalDebit,credit:totalCredit,balanced:Math.abs(totalDebit-totalCredit)<0.005}});
});
// P578: organisation-scoped financial statements from posted double-entry journals.
financeRouter.get('/finance/profit-and-loss',requirePermission('finance:view'),async(req,res)=>{
 const from=z.string().date().safeParse(req.query.from),to=z.string().date().safeParse(req.query.to);
 if(!from.success||!to.success||from.data>to.data)return res.status(400).json({error:{code:'INVALID_DATE_RANGE'}});
 const r=await pool.query(`SELECT a.id,a.code,a.name,a.account_type,
  COALESCE(SUM(CASE WHEN a.account_type='INCOME' THEN l.credit-l.debit ELSE l.debit-l.credit END),0)::numeric(14,2) AS balance
  FROM finance_accounts a LEFT JOIN (
   SELECT jl.account_id,jl.organisation_id,jl.debit,jl.credit FROM finance_journal_lines jl
   JOIN finance_journals j ON j.id=jl.journal_id AND j.organisation_id=jl.organisation_id
   WHERE j.organisation_id=$1 AND j.status='POSTED' AND j.journal_date BETWEEN $2 AND $3
  ) l ON l.account_id=a.id AND l.organisation_id=a.organisation_id
  WHERE a.organisation_id=$1 AND a.account_type IN ('INCOME','EXPENSE')
  GROUP BY a.id ORDER BY a.account_type,a.code`,[req.auth!.organisationId,from.data,to.data]);
 const rows=r.rows.map((x:any)=>({...x,balance:Number(x.balance)}));
 const income=rows.filter((x:any)=>x.account_type==='INCOME').reduce((n:number,x:any)=>n+x.balance,0);
 const expense=rows.filter((x:any)=>x.account_type==='EXPENSE').reduce((n:number,x:any)=>n+x.balance,0);
 return res.json({data:rows,totals:{income,expenses:expense,netProfit:income-expense,currency:'INR'}});
});
financeRouter.get('/finance/balance-sheet',requirePermission('finance:view'),async(req,res)=>{
 const asOf=z.string().date().safeParse(req.query.asOf);
 if(!asOf.success)return res.status(400).json({error:{code:'INVALID_AS_OF_DATE'}});
 const r=await pool.query(`SELECT a.id,a.code,a.name,a.account_type,
  COALESCE(SUM(CASE WHEN a.account_type IN ('ASSET','EXPENSE') THEN l.debit-l.credit ELSE l.credit-l.debit END),0)::numeric(14,2) AS balance
  FROM finance_accounts a LEFT JOIN (
   SELECT jl.account_id,jl.organisation_id,jl.debit,jl.credit FROM finance_journal_lines jl
   JOIN finance_journals j ON j.id=jl.journal_id AND j.organisation_id=jl.organisation_id
   WHERE j.organisation_id=$1 AND j.status='POSTED' AND j.journal_date<=$2
  ) l ON l.account_id=a.id AND l.organisation_id=a.organisation_id
  WHERE a.organisation_id=$1 AND a.account_type IN ('ASSET','LIABILITY','EQUITY')
  GROUP BY a.id ORDER BY a.account_type,a.code`,[req.auth!.organisationId,asOf.data]);
 const rows=r.rows.map((x:any)=>({...x,balance:Number(x.balance)}));
 const sum=(t:string)=>rows.filter((x:any)=>x.account_type===t).reduce((n:number,x:any)=>n+x.balance,0);
 const assets=sum('ASSET'),liabilities=sum('LIABILITY'),equity=sum('EQUITY');
 const earnings=await pool.query(`SELECT COALESCE(SUM(CASE WHEN a.account_type='INCOME' THEN l.credit-l.debit ELSE l.debit-l.credit END),0)::numeric(14,2) earnings
  FROM finance_accounts a JOIN finance_journal_lines l ON l.account_id=a.id AND l.organisation_id=a.organisation_id
  JOIN finance_journals j ON j.id=l.journal_id AND j.organisation_id=l.organisation_id
  WHERE a.organisation_id=$1 AND a.account_type IN ('INCOME','EXPENSE') AND j.status='POSTED' AND j.journal_date<=$2`,
  [req.auth!.organisationId,asOf.data]);
 const currentEarnings=Number(earnings.rows[0].earnings),equityIncludingCurrentEarnings=equity+currentEarnings;
 return res.json({data:rows,totals:{assets,liabilities,equity,currentEarnings,equityIncludingCurrentEarnings,liabilitiesAndEquity:liabilities+equityIncludingCurrentEarnings,balanced:Math.abs(assets-liabilities-equityIncludingCurrentEarnings)<0.02,asOf:asOf.data,currency:'INR'}});
});
financeRouter.get('/finance/cash-flow',requirePermission('finance:view'),async(req,res)=>{
 const from=z.string().date().safeParse(req.query.from),to=z.string().date().safeParse(req.query.to);
 if(!from.success||!to.success||from.data>to.data)return res.status(400).json({error:{code:'INVALID_DATE_RANGE'}});
 const r=await pool.query(`SELECT a.id,a.code,a.name,
  COALESCE(SUM(l.debit-l.credit),0)::numeric(14,2) AS net_cash_movement
  FROM finance_accounts a JOIN finance_journal_lines l ON l.account_id=a.id AND l.organisation_id=a.organisation_id
  JOIN finance_journals j ON j.id=l.journal_id AND j.organisation_id=l.organisation_id
  WHERE a.organisation_id=$1 AND a.account_type='ASSET' AND (a.code ILIKE '10%' OR a.name ILIKE '%cash%' OR a.name ILIKE '%bank%')
    AND j.status='POSTED' AND j.journal_date BETWEEN $2 AND $3
  GROUP BY a.id ORDER BY a.code`,[req.auth!.organisationId,from.data,to.data]);
 const rows=r.rows.map((x:any)=>({...x,net_cash_movement:Number(x.net_cash_movement)}));
 return res.json({data:rows,totals:{netMovement:rows.reduce((n:number,x:any)=>n+x.net_cash_movement,0),from:from.data,to:to.data,currency:'INR',classification:'Cash/bank account movement; not a full indirect cash-flow statement'}});
});
financeRouter.get('/finance/inventory-valuation',requirePermission('finance:view'),async(req,res)=>{
 const outlet=typeof req.query.outletId==='string'?req.query.outletId:null;
 const r=await pool.query(`WITH layers AS (
  SELECT organisation_id,product_id,SUM(remaining_units)::numeric(14,3) layer_units,
         SUM(remaining_units*unit_cost)::numeric(14,2) fifo_value
  FROM inventory_cost_layers WHERE organisation_id=$1 AND ($2::uuid IS NULL OR outlet_id=$2) AND remaining_units>0
  GROUP BY organisation_id,product_id
 ), balances AS (
  SELECT organisation_id,product_id,SUM(quantity_units)::numeric(14,3) on_hand
  FROM stock_balances WHERE organisation_id=$1 AND ($2::uuid IS NULL OR outlet_id=$2)
  GROUP BY organisation_id,product_id
 )
 SELECT p.id product_id,p.sku,p.name,COALESCE(l.layer_units,0)::numeric(14,3) layer_units,
        COALESCE(l.fifo_value,0)::numeric(14,2) fifo_value,COALESCE(b.on_hand,0)::numeric(14,3) on_hand
 FROM products p LEFT JOIN layers l ON l.product_id=p.id AND l.organisation_id=p.organisation_id
 LEFT JOIN balances b ON b.product_id=p.id AND b.organisation_id=p.organisation_id
 WHERE p.organisation_id=$1 AND p.status='ACTIVE' ORDER BY p.name`,
 [req.auth!.organisationId,outlet]);
 const rows=r.rows.map((x:any)=>({...x,layer_units:Number(x.layer_units),fifo_value:Number(x.fifo_value),on_hand:Number(x.on_hand),unvalued_units:Number((Number(x.on_hand)-Number(x.layer_units)).toFixed(3))}));
 return res.json({data:rows,totals:{fifoValue:rows.reduce((n:number,x:any)=>n+x.fifo_value,0),unvaluedUnits:rows.reduce((n:number,x:any)=>n+x.unvalued_units,0),currency:'INR'}});
});
financeRouter.get('/finance/inventory-cost-exceptions',requirePermission('finance:view'),async(req,res)=>{
 const r=await pool.query(`SELECT e.*,p.sku,p.name FROM inventory_cost_exceptions e JOIN products p ON p.id=e.product_id AND p.organisation_id=e.organisation_id
 WHERE e.organisation_id=$1 AND ($2='ALL' OR e.status=$2) ORDER BY e.created_at DESC LIMIT 500`,
 [req.auth!.organisationId,typeof req.query.status==='string'?req.query.status:'OPEN']);
 return res.json({data:r.rows});
});
function jNum(v:unknown){return Number(v??0);}
