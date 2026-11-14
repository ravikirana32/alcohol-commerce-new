import { Router } from 'express';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { requireOrgScope } from '../middleware/requireOrgScope.js';

export const financeAutomationRouter = Router();
financeAutomationRouter.use(authenticate, requireOrgScope);
const uuid=z.string().uuid();
const mappingSchema=z.object({eventType:z.enum(['SALES','REFUND','SETTLEMENT','COGS','PURCHASE']),debitAccountId:uuid,creditAccountId:uuid,taxAccountId:uuid.optional(),feeAccountId:uuid.optional(),inventoryAccountId:uuid.optional()});
financeAutomationRouter.put('/finance/accounting-mappings/:eventType',requirePermission('finance:manage'),async(req,res)=>{
 const parsed=mappingSchema.safeParse({...req.body,eventType:req.params.eventType});
 if(!parsed.success)return res.status(400).json({error:{code:'INVALID_ACCOUNTING_MAPPING',details:parsed.error.flatten()}});
 const d=parsed.data,org=req.auth!.organisationId!;
 const ids=[d.debitAccountId,d.creditAccountId,d.taxAccountId,d.feeAccountId,d.inventoryAccountId].filter(Boolean);
 const valid=await pool.query('SELECT id FROM finance_accounts WHERE organisation_id=$1 AND id=ANY($2::uuid[]) AND is_active=true AND is_postable=true',[org,ids]);
 if(valid.rowCount!==new Set(ids).size)return res.status(400).json({error:{code:'INVALID_OR_INACTIVE_ACCOUNT'}});
 const r=await pool.query(`INSERT INTO p536_accounting_mappings(organisation_id,event_type,debit_account_id,credit_account_id,tax_account_id,fee_account_id,inventory_account_id,created_by)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(organisation_id,event_type) DO UPDATE SET debit_account_id=EXCLUDED.debit_account_id,credit_account_id=EXCLUDED.credit_account_id,tax_account_id=EXCLUDED.tax_account_id,fee_account_id=EXCLUDED.fee_account_id,inventory_account_id=EXCLUDED.inventory_account_id,is_active=true RETURNING *`,[org,d.eventType,d.debitAccountId,d.creditAccountId,d.taxAccountId??null,d.feeAccountId??null,d.inventoryAccountId??null,req.auth!.userId]);
 return res.json({data:r.rows[0]});
});
const postingSchema=z.object({sourceType:z.enum(['SALES','REFUND','SETTLEMENT','COGS','PURCHASE']),sourceId:uuid,outletId:uuid.optional(),postingDate:z.string().date(),description:z.string().trim().min(3).max(500),debitAmount:z.number().positive().max(999999999),taxAmount:z.number().min(0).default(0),feeAmount:z.number().min(0).default(0),inventoryCost:z.number().min(0).default(0),currency:z.literal('INR').default('INR')});
financeAutomationRouter.post('/finance/source-postings',requirePermission('finance:manage'),async(req,res)=>{
 const parsed=postingSchema.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:{code:'INVALID_SOURCE_POSTING',details:parsed.error.flatten()}});
 const d=parsed.data,org=req.auth!.organisationId!,c=await pool.connect();
 const fingerprint=createHash('sha256').update(JSON.stringify({...d,organisationId:org})).digest('hex');
 try{
  await c.query('BEGIN');
  const existing=await c.query('SELECT sp.*,j.journal_number FROM p536_source_postings sp LEFT JOIN finance_journals j ON j.id=sp.journal_id WHERE sp.organisation_id=$1 AND sp.source_type=$2 AND sp.source_id=$3',[org,d.sourceType,d.sourceId]);
  if(existing.rowCount){if(existing.rows[0].event_fingerprint!==fingerprint){await c.query('ROLLBACK');return res.status(409).json({error:{code:'SOURCE_ID_REPLAY_PAYLOAD_MISMATCH'}});}await c.query('COMMIT');return res.json({data:existing.rows[0],idempotentReplay:true});}
  const period=await c.query(`SELECT status FROM p536_accounting_periods WHERE organisation_id=$1 AND $2::date BETWEEN starts_on AND ends_on ORDER BY starts_on DESC LIMIT 1`,[org,d.postingDate]);
  if(period.rowCount&&period.rows[0].status!=='OPEN'){await c.query('ROLLBACK');return res.status(409).json({error:{code:'ACCOUNTING_PERIOD_CLOSED'}});}
  const map=await c.query('SELECT * FROM p536_accounting_mappings WHERE organisation_id=$1 AND event_type=$2 AND is_active=true FOR SHARE',[org,d.sourceType]);
  if(!map.rowCount){await c.query('ROLLBACK');return res.status(409).json({error:{code:'ACCOUNTING_MAPPING_REQUIRED',eventType:d.sourceType}});}
  const m=map.rows[0];
  const mappedIds=[m.debit_account_id,m.credit_account_id,m.tax_account_id,m.fee_account_id,m.inventory_account_id].filter(Boolean);
  const mappedValid=await c.query('SELECT id FROM finance_accounts WHERE organisation_id=$1 AND id=ANY($2::uuid[]) AND is_active=true AND is_postable=true',[org,mappedIds]);
  if(mappedValid.rowCount!==new Set(mappedIds).size){await c.query('ROLLBACK');return res.status(409).json({error:{code:'ACCOUNT_MAPPING_NOT_POSTABLE'}});}
  if(d.taxAmount>0&&!m.tax_account_id){await c.query('ROLLBACK');return res.status(409).json({error:{code:'TAX_ACCOUNT_MAPPING_REQUIRED'}});}
  if(d.feeAmount>0&&!m.fee_account_id){await c.query('ROLLBACK');return res.status(409).json({error:{code:'FEE_ACCOUNT_MAPPING_REQUIRED'}});}
  if((d.inventoryCost>0||d.sourceType==='COGS')&&!m.inventory_account_id){await c.query('ROLLBACK');return res.status(409).json({error:{code:'INVENTORY_ACCOUNT_MAPPING_REQUIRED'}});}
  const journalNo=`AUTO-${d.sourceType}-${d.sourceId}`;
  const j=await c.query(`INSERT INTO finance_journals(organisation_id,outlet_id,journal_number,journal_date,source_type,source_id,description,created_by,status)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,'DRAFT') RETURNING id,journal_number`,[org,d.outletId??null,journalNo,d.postingDate,d.sourceType,d.sourceId,d.description,req.auth!.userId]);
  const lines:Array<[string,number,number,string]>=[];
  if(d.sourceType==='SALES'){
   if(d.taxAmount>d.debitAmount){await c.query('ROLLBACK');return res.status(400).json({error:{code:'TAX_EXCEEDS_GROSS'}});}
   lines.push([m.debit_account_id,d.debitAmount,0,'Payment clearing / tender control'],[m.credit_account_id,0,d.debitAmount-d.taxAmount,'Net sales revenue']);
   if(d.taxAmount>0)lines.push([m.tax_account_id,0,d.taxAmount,'Tax payable from immutable tax snapshot']);
  } else if(d.sourceType==='SETTLEMENT') {
   if(d.feeAmount>d.debitAmount){await c.query('ROLLBACK');return res.status(400).json({error:{code:'FEE_EXCEEDS_GROSS'}});}
   lines.push([m.debit_account_id,d.debitAmount-d.feeAmount,0,'Bank payout'],[m.credit_account_id,0,d.debitAmount,'Provider clearing']);
   if(d.feeAmount>0)lines.push([m.fee_account_id,d.feeAmount,0,'Provider MDR / settlement fee']);
  } else if(d.sourceType==='COGS') {
   const cost=d.inventoryCost>0?d.inventoryCost:d.debitAmount;
   lines.push([m.debit_account_id,cost,0,'Cost of goods sold'],[m.inventory_account_id,0,cost,'Inventory asset reduction']);
  } else if(d.sourceType==='PURCHASE') {
   lines.push([m.debit_account_id,d.debitAmount,0,'Inventory / purchase debit'],[m.credit_account_id,0,d.debitAmount,'Supplier payable / purchase credit']);
  } else {
   if(d.taxAmount>d.debitAmount){await c.query('ROLLBACK');return res.status(400).json({error:{code:'TAX_EXCEEDS_REFUND_GROSS'}});}
   lines.push([m.debit_account_id,d.debitAmount-d.taxAmount,0,'Refund / contra-revenue reversal'],[m.credit_account_id,0,d.debitAmount,'Refund tender clearing']);
   if(d.taxAmount>0)lines.push([m.tax_account_id,d.taxAmount,0,'Tax payable reversal from original tax snapshot']);
  }
  // Enforce exact double-entry equality before any journal can be posted.
  const deb=lines.reduce((n,x)=>n+x[1],0),cred=lines.reduce((n,x)=>n+x[2],0);
  if(Math.abs(deb-cred)>0.005){await c.query('ROLLBACK');return res.status(400).json({error:{code:'SOURCE_POSTING_COMPONENTS_UNBALANCED',debit:deb,credit:cred}});}
  for(const l of lines)await c.query('INSERT INTO finance_journal_lines(journal_id,organisation_id,account_id,debit,credit,memo) VALUES($1,$2,$3,$4,$5,$6)',[j.rows[0].id,org,l[0],l[1],l[2],l[3]]);
  await c.query("UPDATE finance_journals SET status='POSTED' WHERE id=$1",[j.rows[0].id]);
  const event=await c.query(`INSERT INTO p536_source_postings(organisation_id,source_type,source_id,outlet_id,event_fingerprint,journal_id,event_payload,created_by) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8) RETURNING *`,[org,d.sourceType,d.sourceId,d.outletId??null,fingerprint,j.rows[0].id,JSON.stringify(d),req.auth!.userId]);
  await c.query('COMMIT');return res.status(201).json({data:{...event.rows[0],journalNumber:j.rows[0].journal_number},idempotentReplay:false});
 }catch(e:any){await c.query('ROLLBACK');if(e.code==='23505')return res.status(409).json({error:{code:'SOURCE_ALREADY_POSTED'}});throw e;}finally{c.release();}
});
const periodSchema=z.object({periodName:z.string().trim().min(3).max(80),startsOn:z.string().date(),endsOn:z.string().date()}).refine(x=>x.startsOn<=x.endsOn);
financeAutomationRouter.post('/finance/periods',requirePermission('finance:manage'),async(req,res)=>{const s=periodSchema.safeParse(req.body);if(!s.success)return res.status(400).json({error:{code:'INVALID_PERIOD'}});const r=await pool.query('INSERT INTO p536_accounting_periods(organisation_id,period_name,starts_on,ends_on) VALUES($1,$2,$3,$4) RETURNING *',[req.auth!.organisationId,s.data.periodName,s.data.startsOn,s.data.endsOn]);return res.status(201).json({data:r.rows[0]});});
financeAutomationRouter.get('/finance/periods',requirePermission('finance:view'),async(req,res)=>{const r=await pool.query('SELECT * FROM p536_accounting_periods WHERE organisation_id=$1 ORDER BY starts_on DESC',[req.auth!.organisationId]);return res.json({data:r.rows});});
financeAutomationRouter.post('/finance/periods/:periodId/close',requirePermission('finance:period:close'),async(req,res)=>{const c=await pool.connect();try{await c.query('BEGIN');const p=await c.query('SELECT * FROM p536_accounting_periods WHERE id=$1 AND organisation_id=$2 FOR UPDATE',[req.params.periodId,req.auth!.organisationId]);if(!p.rowCount){await c.query('ROLLBACK');return res.status(404).json({error:{code:'PERIOD_NOT_FOUND'}});}const totals=await c.query(`SELECT COALESCE(SUM(l.debit),0)::numeric(14,2) debit,COALESCE(SUM(l.credit),0)::numeric(14,2) credit
 FROM finance_journals j JOIN finance_journal_lines l ON l.journal_id=j.id AND l.organisation_id=j.organisation_id
 WHERE j.organisation_id=$1 AND j.journal_date BETWEEN $2 AND $3 AND j.status='POSTED'`,
 [req.auth!.organisationId,p.rows[0].starts_on,p.rows[0].ends_on]);
 const unbalanced=await c.query(`SELECT COUNT(*)::int n FROM (SELECT j.id FROM finance_journals j JOIN finance_journal_lines l ON l.journal_id=j.id AND l.organisation_id=j.organisation_id WHERE j.organisation_id=$1 AND j.status='POSTED' AND j.journal_date BETWEEN $2 AND $3 GROUP BY j.id HAVING ABS(SUM(l.debit)-SUM(l.credit))>=0.02) q`,[req.auth!.organisationId,p.rows[0].starts_on,p.rows[0].ends_on]);
 const payment=await c.query(`SELECT COUNT(*)::int n FROM p535_payment_exceptions WHERE organisation_id=$1 AND status IN ('OPEN','UNDER_REVIEW') AND created_at::date <= $2`,
 [req.auth!.organisationId,p.rows[0].ends_on]);
 const cost=await c.query(`SELECT COUNT(*)::int n FROM inventory_cost_exceptions WHERE organisation_id=$1 AND status='OPEN' AND created_at::date <= $2`,
 [req.auth!.organisationId,p.rows[0].ends_on]);
 const balanced=Math.abs(Number(totals.rows[0].debit)-Number(totals.rows[0].credit))<0.02;
 const ok=balanced&&Number(unbalanced.rows[0].n)===0&&Number(payment.rows[0].n)===0&&Number(cost.rows[0].n)===0;
 await c.query(`INSERT INTO p578_period_close_checks(organisation_id,period_id,checked_by,trial_balance_debit,trial_balance_credit,unbalanced_journal_count,unresolved_payment_exception_count,unresolved_cost_exception_count,status,notes)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
 [req.auth!.organisationId,req.params.periodId,req.auth!.userId,totals.rows[0].debit,totals.rows[0].credit,unbalanced.rows[0].n,payment.rows[0].n,cost.rows[0].n,ok?'PASS':'BLOCKED','Automated period close validation']);
 if(!ok){await c.query('COMMIT');return res.status(409).json({error:{code:'PERIOD_CLOSE_CHECKS_BLOCKED',trialBalanceBalanced:balanced,unbalancedJournals:unbalanced.rows[0].n,unresolvedPaymentExceptions:payment.rows[0].n,unresolvedCostExceptions:cost.rows[0].n}});}
 const r=await c.query("UPDATE p536_accounting_periods SET status='CLOSED',closed_by=$2,closed_at=now() WHERE id=$1 RETURNING *",[req.params.periodId,req.auth!.userId]);await c.query('COMMIT');return res.json({data:r.rows[0]});}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}});
