import { Router } from 'express';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { requireOrgScope } from '../middleware/requireOrgScope.js';
import { validatePegQuarantineDecision } from '../services/pegQuarantineDisposition.js';
import { appendStockMovementOnce } from '../services/stockMovementIdempotency.js';

export const settlementsRouter = Router();
settlementsRouter.use(authenticate, requireOrgScope);
const uuid = z.string().uuid();
const refundSchema = z.object({ amount: z.number().positive(), reason: z.string().trim().min(3).max(1000), method: z.enum(['CASH','UPI','CARD','WALLET','OTHER']), reference: z.string().max(160).optional(), restock: z.boolean().default(false), restockAllocations: z.array(z.object({ saleLineId: uuid, quantity: z.number().positive() })).default([]) });
const barRefundSchema = refundSchema.omit({restock:true,restockAllocations:true}).extend({
 approvalRequestId:uuid,
 idempotencyKey:z.string().trim().min(16).max(160).optional(),
 pegRestorations: z.array(z.object({ ticketLineId: uuid, volumeMl: z.number().int().positive() })).default([])
});
const refundKey=(req:any)=>{const value=req.get('Idempotency-Key')??req.body?.idempotencyKey;return typeof value==='string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{15,120}$/.test(value)?value:null;};
const refundFingerprint=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

// P577: bank statement import and deterministic settlement matching evidence.
settlementsRouter.post('/finance/bank-statement-lines',requirePermission('payments:operate'),async(req,res)=>{
 const parsed=z.object({outletId:uuid,bankAccountReference:z.string().trim().min(2).max(100),lines:z.array(z.object({
  statementReference:z.string().trim().min(2).max(160),transactionDate:z.string().date(),amount:z.number(),currency:z.string().length(3).default('INR'),description:z.string().max(500).optional()
 })).min(1).max(1000)}).safeParse(req.body);
 if(!parsed.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:parsed.error.flatten()}});
 const c=await pool.connect();try{await c.query('BEGIN');
  const outlet=await c.query('SELECT id FROM outlets WHERE id=$1 AND organisation_id=$2',[parsed.data.outletId,req.auth!.organisationId]);
  if(!outlet.rowCount){await c.query('ROLLBACK');return res.status(404).json({error:{code:'OUTLET_NOT_FOUND'}});}
  const out=[];
  for(const line of parsed.data.lines){
   const r=await c.query(`INSERT INTO p577_bank_statement_lines(organisation_id,outlet_id,bank_account_reference,statement_reference,transaction_date,amount,currency,description,imported_by)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(organisation_id,bank_account_reference,statement_reference) DO NOTHING RETURNING *`,
    [req.auth!.organisationId,parsed.data.outletId,parsed.data.bankAccountReference,line.statementReference,line.transactionDate,line.amount,line.currency,line.description??null,req.auth!.userId]);
   out.push(r.rows[0]??{statementReference:line.statementReference,replayed:true});
  }
  await c.query('COMMIT');return res.status(201).json({data:out});
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
});
settlementsRouter.get('/finance/bank-statement-lines',requirePermission('finance:view'),async(req,res)=>{
 const r=await pool.query(`SELECT * FROM p577_bank_statement_lines WHERE organisation_id=$1 AND ($2::uuid IS NULL OR outlet_id=$2) AND ($3='ALL' OR status=$3) ORDER BY transaction_date DESC LIMIT 1000`,
 [req.auth!.organisationId,typeof req.query.outletId==='string'?req.query.outletId:null,typeof req.query.status==='string'?req.query.status:'ALL']);
 res.json({data:r.rows});
});
settlementsRouter.post('/finance/bank-statement-lines/:lineId/match',requirePermission('payments:operate'),async(req,res)=>{
 const c=await pool.connect();try{await c.query('BEGIN');
  const line=await c.query('SELECT * FROM p577_bank_statement_lines WHERE id=$1 AND organisation_id=$2 FOR UPDATE',[req.params.lineId,req.auth!.organisationId]);
  if(!line.rowCount){await c.query('ROLLBACK');return res.status(404).json({error:{code:'BANK_LINE_NOT_FOUND'}});}
  if(line.rows[0].status!=='UNMATCHED'){await c.query('ROLLBACK');return res.status(409).json({error:{code:'BANK_LINE_ALREADY_MATCHED'}});}
  const batch=await c.query(`SELECT * FROM p535_settlement_batches WHERE id=$1 AND organisation_id=$2 AND outlet_id=$3 FOR UPDATE`,
   [req.body.settlementBatchId,req.auth!.organisationId,line.rows[0].outlet_id]);
  if(!batch.rowCount){await c.query('ROLLBACK');return res.status(404).json({error:{code:'SETTLEMENT_BATCH_NOT_FOUND'}});}
  const diff=Math.abs(Number(line.rows[0].amount)-Number(batch.rows[0].net_amount));
  const currencyMatch=line.rows[0].currency===batch.rows[0].currency;
  const status=diff<0.02&&currencyMatch?'MATCHED':'VARIANCE';
  const updated=await c.query(`UPDATE p577_bank_statement_lines SET matched_settlement_batch_id=$1,status=$2 WHERE id=$3 AND organisation_id=$4 RETURNING *`,
   [batch.rows[0].id,status,line.rows[0].id,req.auth!.organisationId]);
  if(status==='MATCHED') await c.query(`UPDATE p535_settlement_batches SET status='BANK_CONFIRMED' WHERE id=$1 AND organisation_id=$2 AND status IN ('IMPORTED','MATCHED','PARTIAL','EXCEPTION')`,
   [batch.rows[0].id,req.auth!.organisationId]);
  await c.query('COMMIT');return res.json({data:updated.rows[0],amountVariance:diff,currencyMatch});
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
});
settlementsRouter.post('/finance/chargebacks',requirePermission('payments:operate'),async(req,res)=>{
 const parsed=z.object({outletId:uuid,tenderAllocationId:uuid.optional(),providerCaseId:z.string().trim().min(2).max(160),amount:z.number().positive(),reason:z.string().trim().min(3).max(1000),evidenceReference:z.string().max(500).optional(),dueAt:z.string().datetime().optional()}).safeParse(req.body);
 if(!parsed.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:parsed.error.flatten()}});
 const outlet=await pool.query('SELECT id FROM outlets WHERE id=$1 AND organisation_id=$2',[parsed.data.outletId,req.auth!.organisationId]);
 if(!outlet.rowCount)return res.status(404).json({error:{code:'OUTLET_NOT_FOUND'}});
 if(parsed.data.tenderAllocationId){
  const tender=await pool.query('SELECT id FROM p535_tender_allocations WHERE id=$1 AND organisation_id=$2 AND outlet_id=$3',[parsed.data.tenderAllocationId,req.auth!.organisationId,parsed.data.outletId]);
  if(!tender.rowCount)return res.status(404).json({error:{code:'TENDER_ALLOCATION_NOT_FOUND'}});
 }
 const r=await pool.query(`INSERT INTO p577_chargeback_cases(organisation_id,outlet_id,tender_allocation_id,provider_case_id,amount,reason,evidence_reference,due_at)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[req.auth!.organisationId,parsed.data.outletId,parsed.data.tenderAllocationId??null,parsed.data.providerCaseId,parsed.data.amount,parsed.data.reason,parsed.data.evidenceReference??null,parsed.data.dueAt??null]);
 res.status(201).json({data:r.rows[0]});
});
settlementsRouter.get('/finance/chargebacks',requirePermission('finance:view'),async(req,res)=>{
 const r=await pool.query('SELECT * FROM p577_chargeback_cases WHERE organisation_id=$1 ORDER BY created_at DESC LIMIT 500',[req.auth!.organisationId]);
 res.json({data:r.rows});
});
settlementsRouter.post('/finance/chargebacks/:caseId/status',requirePermission('payments:operate'),async(req,res)=>{
 const parsed=z.object({status:z.enum(['EVIDENCE_SUBMITTED','WON','LOST','CLOSED']),evidenceReference:z.string().max(500).optional()}).safeParse(req.body);
 if(!parsed.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:parsed.error.flatten()}});
 const r=await pool.query(`UPDATE p577_chargeback_cases SET status=$1,evidence_reference=COALESCE($2,evidence_reference),resolved_at=CASE WHEN $1 IN ('WON','LOST','CLOSED') THEN NOW() ELSE NULL END
 WHERE id=$3 AND organisation_id=$4 AND status IN ('OPEN','EVIDENCE_SUBMITTED') RETURNING *`,
 [parsed.data.status,parsed.data.evidenceReference??null,req.params.caseId,req.auth!.organisationId]);
 if(!r.rowCount)return res.status(409).json({error:{code:'CHARGEBACK_NOT_TRANSITIONABLE'}});
 res.json({data:r.rows[0]});
});

settlementsRouter.post('/retail/sales/:saleId/refunds', requirePermission('retail:refund'), async (req,res) => {
  const parsed=refundSchema.safeParse(req.body); if(!parsed.success) return res.status(400).json({error:{code:'VALIDATION_ERROR',details:parsed.error.flatten()}});
  const key=refundKey(req); if(!key) return res.status(400).json({error:{code:'IDEMPOTENCY_KEY_REQUIRED',message:'Supply a 16-160 character Idempotency-Key and reuse it for retries.'}});
  const fingerprint=refundFingerprint({saleId:req.params.saleId,...parsed.data});
  const client=await pool.connect(); const org=req.auth!.organisationId!;
  try { await client.query('BEGIN');
    const sale=await client.query(`SELECT * FROM retail_sales WHERE id=$1 AND organisation_id=$2 FOR UPDATE`,[req.params.saleId,org]);
    if(!sale.rowCount){await client.query('ROLLBACK');return res.status(404).json({error:{code:'SALE_NOT_FOUND'}});}
    const replay=await client.query('SELECT * FROM retail_refunds WHERE organisation_id=$1 AND outlet_id=$2 AND idempotency_key=$3',[org,sale.rows[0].outlet_id,key]);
    if(replay.rowCount){if(replay.rows[0].request_fingerprint!==fingerprint){await client.query('ROLLBACK');return res.status(409).json({error:{code:'IDEMPOTENCY_KEY_CONFLICT',message:'This key was already used with a different refund payload.'}});} const sums=await client.query('SELECT COALESCE(SUM(amount),0) amount FROM retail_refunds WHERE sale_id=$1',[req.params.saleId]); await client.query('COMMIT'); return res.status(200).json({data:replay.rows[0],remainingRefundable:Math.max(0,Number(sale.rows[0].grand_total)-Number(sums.rows[0].amount)),replayed:true});}
    if(sale.rows[0].status!=='COMPLETED'){await client.query('ROLLBACK');return res.status(409).json({error:{code:'SALE_NOT_REFUNDABLE',message:'Only completed sales can be refunded'}});}
    const prior=await client.query('SELECT COALESCE(SUM(amount),0) amount FROM retail_refunds WHERE sale_id=$1',[req.params.saleId]);
    const remaining=Number(sale.rows[0].grand_total)-Number(prior.rows[0].amount);
    if(parsed.data.amount>remaining+0.001){await client.query('ROLLBACK');return res.status(409).json({error:{code:'REFUND_EXCEEDS_REMAINING',remainingAmount:remaining}});}
    const refund=await client.query(`INSERT INTO retail_refunds(organisation_id,outlet_id,sale_id,amount,reason,refund_method,reference,restock,created_by,idempotency_key,request_fingerprint) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,[org,sale.rows[0].outlet_id,req.params.saleId,parsed.data.amount,parsed.data.reason,parsed.data.method,parsed.data.reference??null,parsed.data.restock,req.auth!.userId,key,fingerprint]);
    if(parsed.data.restock){
      if(!parsed.data.restockAllocations.length){await client.query('ROLLBACK');return res.status(400).json({error:{code:'RESTOCK_ALLOCATION_REQUIRED',message:'Select the exact returned SKU quantities before restocking'}});}
      const seen=new Set<string>();
      for(const allocation of parsed.data.restockAllocations){
        if(seen.has(allocation.saleLineId)){await client.query('ROLLBACK');return res.status(400).json({error:{code:'DUPLICATE_RESTOCK_LINE'}});}
        seen.add(allocation.saleLineId);
        const original=await client.query('SELECT id,product_id,quantity_units FROM retail_sale_lines WHERE id=$1 AND sale_id=$2 FOR UPDATE',[allocation.saleLineId,req.params.saleId]);
        if(!original.rowCount){await client.query('ROLLBACK');return res.status(400).json({error:{code:'INVALID_RESTOCK_LINE',saleLineId:allocation.saleLineId}});}
        const priorQty=await client.query('SELECT COALESCE(SUM(quantity),0) quantity FROM retail_refund_restock_lines WHERE sale_line_id=$1',[allocation.saleLineId]);
        const available=Number(original.rows[0].quantity_units)-Number(priorQty.rows[0].quantity);
        if(allocation.quantity>available+0.0001){await client.query('ROLLBACK');return res.status(409).json({error:{code:'RESTOCK_QUANTITY_EXCEEDED',saleLineId:allocation.saleLineId,availableQuantity:available}});}
        await client.query(`INSERT INTO retail_refund_restock_lines(refund_id,sale_line_id,product_id,quantity) VALUES($1,$2,$3,$4)`,[refund.rows[0].id,allocation.saleLineId,original.rows[0].product_id,allocation.quantity]);
        await client.query(`INSERT INTO stock_balances(organisation_id,outlet_id,product_id,quantity_units) VALUES($1,$2,$3,$4) ON CONFLICT(outlet_id,product_id) DO UPDATE SET quantity_units=stock_balances.quantity_units+EXCLUDED.quantity_units,updated_at=NOW()`,[org,sale.rows[0].outlet_id,original.rows[0].product_id,allocation.quantity]);
        const movement=await appendStockMovementOnce(client,{organisationId:org,outletId:sale.rows[0].outlet_id,productId:original.rows[0].product_id,movementType:'RETURN',quantityUnits:allocation.quantity,referenceType:'RETAIL_REFUND',referenceId:refund.rows[0].id,idempotencyKey:`retail-refund:${createHash('sha256').update(key).digest('hex')}:line:${allocation.saleLineId}`,notes:parsed.data.reason,createdBy:req.auth!.userId});
        if(!movement.created) throw Object.assign(new Error('Refund stock movement already exists before its refund transaction completed'),{code:'REFUND_STOCK_MOVEMENT_CONFLICT'});
      }
    } else if(parsed.data.restockAllocations.length){await client.query('ROLLBACK');return res.status(400).json({error:{code:'RESTOCK_FLAG_REQUIRED'}});}
    const refunded=Number(prior.rows[0].amount)+parsed.data.amount;
    await client.query(`UPDATE retail_sales SET status=CASE WHEN $1 >= grand_total THEN 'REFUNDED' ELSE status END, payment_status=CASE WHEN $1 >= grand_total THEN 'REFUNDED' ELSE 'PARTIAL' END WHERE id=$2 AND organisation_id=$3`,[refunded,req.params.saleId,org]);
    await client.query(`INSERT INTO audit_events(organisation_id,outlet_id,actor_user_id,event_type,entity_type,entity_id,reason,metadata) VALUES($1,$2,$3,'RETAIL_REFUND_CREATED','RETAIL_SALE',$4,$5,$6)`,[org,sale.rows[0].outlet_id,req.auth!.userId,req.params.saleId,parsed.data.reason,{amount:parsed.data.amount,restock:parsed.data.restock,restockAllocations:parsed.data.restockAllocations}]);
    await client.query('COMMIT'); return res.status(201).json({data:refund.rows[0],remainingRefundable:Math.max(0,Number(sale.rows[0].grand_total)-refunded)});
  } catch(e:any){await client.query('ROLLBACK');if(e?.code==='23505')return res.status(409).json({error:{code:'IDEMPOTENCY_KEY_CONFLICT',message:'This Idempotency-Key is already in use for another refund request.'}});throw e;} finally{client.release();}
});


settlementsRouter.post('/bar/tickets/:ticketId/refunds', requirePermission('bar:refund'), async (req,res) => {
  const parsed=barRefundSchema.safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:parsed.error.flatten()}});
  const key=refundKey(req); if(!key)return res.status(400).json({error:{code:'IDEMPOTENCY_KEY_REQUIRED',message:'Supply a 16-160 character Idempotency-Key and reuse it for retries.'}});
  if(parsed.data.idempotencyKey&&parsed.data.idempotencyKey!==key)return res.status(400).json({error:{code:'IDEMPOTENCY_KEY_MISMATCH'}});
  const {approvalRequestId}=parsed.data;
  const refundPayload={
    amount:parsed.data.amount,reason:parsed.data.reason,method:parsed.data.method,
    reference:parsed.data.reference,idempotencyKey:key,pegRestorations:parsed.data.pegRestorations
  };
  const fingerprint=refundFingerprint({ticketId:req.params.ticketId,...refundPayload});
  const client=await pool.connect(); const org=req.auth!.organisationId!;
  try{await client.query('BEGIN');
    const ticket=await client.query('SELECT * FROM bar_tickets WHERE id=$1 AND organisation_id=$2 FOR UPDATE',[req.params.ticketId,org]);
    if(!ticket.rowCount){await client.query('ROLLBACK');return res.status(404).json({error:{code:'TICKET_NOT_FOUND'}});}
    const replay=await client.query('SELECT * FROM bar_refunds WHERE organisation_id=$1 AND outlet_id=$2 AND idempotency_key=$3',[org,ticket.rows[0].outlet_id,key]);
    if(replay.rowCount){if(replay.rows[0].request_fingerprint!==fingerprint){await client.query('ROLLBACK');return res.status(409).json({error:{code:'IDEMPOTENCY_KEY_CONFLICT',message:'This key was already used with a different refund payload.'}});} const sums=await client.query('SELECT COALESCE(SUM(amount),0) amount FROM bar_refunds WHERE ticket_id=$1',[req.params.ticketId]); await client.query('COMMIT'); return res.status(200).json({data:replay.rows[0],remainingRefundable:Math.max(0,Number(ticket.rows[0].grand_total)-Number(sums.rows[0].amount)),inventoryRestored:false,replayed:true});}
    if(ticket.rows[0].status!=='PAID'){await client.query('ROLLBACK');return res.status(409).json({error:{code:'TICKET_NOT_REFUNDABLE',message:'Only paid tickets can be refunded'}});}
    const approval=await client.query(
      `SELECT * FROM bar_ticket_approval_requests
       WHERE id=$1 AND ticket_id=$2 AND organisation_id=$3 AND request_type='REFUND' AND status='APPROVED'
       FOR UPDATE`,
      [approvalRequestId,req.params.ticketId,org]
    );
    if(!approval.rowCount||approval.rows[0].requested_by===approval.rows[0].decided_by){
      await client.query('ROLLBACK');
      return res.status(409).json({error:{code:'REFUND_APPROVAL_REQUIRED',message:'A different manager must approve this refund before it can be executed'}});
    }
    const approvedPayload=approval.rows[0].request_payload as {
      amount:number;reason:string;method:string;reference?:string;idempotencyKey:string;
      pegRestorations:Array<{ticketLineId:string;volumeMl:number}>
    };
    const approvedFingerprint=refundFingerprint({
      ticketId:req.params.ticketId,amount:approvedPayload.amount,reason:approvedPayload.reason,
      method:approvedPayload.method,reference:approvedPayload.reference,idempotencyKey:approvedPayload.idempotencyKey,
      pegRestorations:approvedPayload.pegRestorations??[]
    });
    if(approvedFingerprint!==fingerprint){
      await client.query('ROLLBACK');
      return res.status(409).json({error:{code:'REFUND_APPROVAL_PAYLOAD_MISMATCH'}});
    }
    const prior=await client.query('SELECT COALESCE(SUM(amount),0) amount FROM bar_refunds WHERE ticket_id=$1',[req.params.ticketId]);
    const remaining=Number(ticket.rows[0].grand_total)-Number(prior.rows[0].amount);
    if(parsed.data.amount>remaining+0.001){await client.query('ROLLBACK');return res.status(409).json({error:{code:'REFUND_EXCEEDS_REMAINING',remainingAmount:remaining}});}
    const refund=await client.query(`INSERT INTO bar_refunds(organisation_id,outlet_id,ticket_id,amount,reason,refund_method,reference,created_by,idempotency_key,request_fingerprint) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,[org,ticket.rows[0].outlet_id,req.params.ticketId,parsed.data.amount,parsed.data.reason,parsed.data.method,parsed.data.reference??null,req.auth!.userId,key,fingerprint]);
    for(const allocation of parsed.data.pegRestorations){
      const line=await client.query(`SELECT id,product_id,line_type,quantity,volume_ml,open_bottle_id FROM bar_ticket_lines WHERE id=$1 AND ticket_id=$2 FOR UPDATE`,[allocation.ticketLineId,req.params.ticketId]);
      if(!line.rowCount||line.rows[0].line_type!=='PEG'||!line.rows[0].open_bottle_id){await client.query('ROLLBACK');return res.status(400).json({error:{code:'INVALID_PEG_REFUND_LINE',ticketLineId:allocation.ticketLineId}});}
      const maxVolume=Number(line.rows[0].quantity)*Number(line.rows[0].volume_ml);
      const priorVolume=await client.query('SELECT COALESCE(SUM(volume_ml),0) volume FROM bar_refund_peg_restorations WHERE ticket_line_id=$1',[allocation.ticketLineId]);
      const available=maxVolume-Number(priorVolume.rows[0].volume);
      if(allocation.volumeMl>available){await client.query('ROLLBACK');return res.status(409).json({error:{code:'PEG_RESTORATION_EXCEEDS_SOLD_VOLUME',ticketLineId:allocation.ticketLineId,availableVolumeMl:available}});}
      const bottle=await client.query(`SELECT id,status FROM open_bottles WHERE id=$1 AND outlet_id=$2 AND organisation_id=$3 AND product_id=$4 FOR UPDATE`,[line.rows[0].open_bottle_id,ticket.rows[0].outlet_id,org,line.rows[0].product_id]);
      if(!bottle.rowCount){await client.query('ROLLBACK');return res.status(409).json({error:{code:'ORIGINAL_OPEN_BOTTLE_UNAVAILABLE'}});}
      // Never pour returned/served liquid back into saleable stock. Record it as quarantined volume for manager disposition.
      await client.query(`INSERT INTO bar_refund_peg_restorations(refund_id,ticket_line_id,open_bottle_id,volume_ml,disposition) VALUES($1,$2,$3,$4,'QUARANTINE_PENDING')`,[refund.rows[0].id,allocation.ticketLineId,line.rows[0].open_bottle_id,allocation.volumeMl]);
      await client.query(`INSERT INTO peg_transactions(organisation_id,outlet_id,open_bottle_id,product_id,volume_ml,transaction_type,reference_id,notes,performed_by) VALUES($1,$2,$3,$4,$5,'ADJUSTMENT',$6,$7,$8)`,[org,ticket.rows[0].outlet_id,line.rows[0].open_bottle_id,line.rows[0].product_id,allocation.volumeMl,refund.rows[0].id,`Returned peg volume quarantined; not added to saleable bottle`,req.auth!.userId]);
    }
    const refunded=Number(prior.rows[0].amount)+parsed.data.amount;
    if(refunded>=Number(ticket.rows[0].grand_total)-0.001) await client.query(`UPDATE bar_tickets SET status='VOIDED' WHERE id=$1`,[req.params.ticketId]);
    await client.query(`INSERT INTO audit_events(organisation_id,outlet_id,actor_user_id,event_type,entity_type,entity_id,reason,metadata) VALUES($1,$2,$3,'BAR_REFUND_CREATED','BAR_TICKET',$4,$5,$6)`,[org,ticket.rows[0].outlet_id,req.auth!.userId,req.params.ticketId,parsed.data.reason,{amount:parsed.data.amount,pegRestorations:parsed.data.pegRestorations}]);
    await client.query(
      `UPDATE bar_ticket_approval_requests SET status='EXECUTED',executed_at=NOW()
       WHERE id=$1 AND organisation_id=$2`,
      [approval.rows[0].id,org]
    );
    await client.query('COMMIT');return res.status(201).json({data:refund.rows[0],remainingRefundable:Math.max(0,remaining-parsed.data.amount),inventoryRestored:false,pegVolumeQuarantined:parsed.data.pegRestorations.length>0,quarantinedPegVolumeMl:parsed.data.pegRestorations.reduce((sum,item)=>sum+item.volumeMl,0)});
  }catch(e:any){await client.query('ROLLBACK');if(e?.code==='23505')return res.status(409).json({error:{code:'IDEMPOTENCY_KEY_CONFLICT',message:'This Idempotency-Key is already in use for another refund request.'}});throw e;}finally{client.release();}
});


const quarantineDispositionSchema = z.object({
  disposition: z.enum(['DISPOSED', 'RELEASED_BY_COMPLIANCE']),
  reason: z.string().trim().min(5).max(1000),
  complianceReference: z.string().trim().min(3).max(160).optional()
}).superRefine((value, ctx) => {
  if (value.disposition === 'RELEASED_BY_COMPLIANCE' && !value.complianceReference) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['complianceReference'], message: 'A documented compliance approval reference is required.' });
  }
});

// Quarantined returned peg volume is never added to saleable stock by this endpoint.
settlementsRouter.get('/bar/peg-quarantine', requirePermission('bar:read'), async (req, res) => {
  const result = await pool.query(
    `SELECT q.id,q.refund_id,q.ticket_line_id,q.open_bottle_id,q.volume_ml,q.disposition,
            q.disposition_reason,q.compliance_reference,q.disposition_by,q.disposition_at,q.created_at,
            t.ticket_number
       FROM bar_refund_peg_restorations q
       JOIN bar_refunds r ON r.id=q.refund_id AND r.organisation_id=$1
       JOIN bar_tickets t ON t.id=r.ticket_id
      WHERE r.organisation_id=$1
      ORDER BY q.created_at DESC LIMIT 250`,
    [req.auth!.organisationId!]
  );
  return res.json({ data: result.rows });
});

settlementsRouter.post('/bar/peg-quarantine/:restorationId/disposition', requirePermission('bar:quarantine:manage'), async (req, res) => {
  const parsed = quarantineDispositionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() } });
  try { validatePegQuarantineDecision(parsed.data); } catch (error) { return res.status(400).json({ error: { code: 'INVALID_QUARANTINE_DISPOSITION', message: error instanceof Error ? error.message : 'Invalid disposition' } }); }
  const client = await pool.connect();
  const org = req.auth!.organisationId!;
  try {
    await client.query('BEGIN');
    const current = await client.query(
      `SELECT q.*,r.outlet_id FROM bar_refund_peg_restorations q
         JOIN bar_refunds r ON r.id=q.refund_id
        WHERE q.id=$1 AND r.organisation_id=$2 FOR UPDATE OF q`,
      [req.params.restorationId, org]
    );
    if (!current.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: { code: 'QUARANTINE_RECORD_NOT_FOUND' } }); }
    if (current.rows[0].disposition !== 'QUARANTINE_PENDING') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: { code: 'QUARANTINE_ALREADY_DISPOSED', currentDisposition: current.rows[0].disposition } });
    }
    if (parsed.data.disposition === 'RELEASED_BY_COMPLIANCE' && !parsed.data.complianceReference) {
      await client.query('ROLLBACK'); return res.status(400).json({ error: { code: 'COMPLIANCE_REFERENCE_REQUIRED' } });
    }
    const updated = await client.query(
      `UPDATE bar_refund_peg_restorations
          SET disposition=$1,disposition_reason=$2,compliance_reference=$3,disposition_by=$4,disposition_at=NOW()
        WHERE id=$5 AND disposition='QUARANTINE_PENDING' RETURNING *`,
      [parsed.data.disposition, parsed.data.reason, parsed.data.complianceReference ?? null, req.auth!.userId, req.params.restorationId]
    );
    await client.query(
      `INSERT INTO audit_events(organisation_id,outlet_id,actor_user_id,event_type,entity_type,entity_id,reason,metadata)
       VALUES($1,$2,$3,'BAR_PEG_QUARANTINE_DISPOSITION','BAR_PEG_RESTORATION',$4,$5,$6)`,
      [org, current.rows[0].outlet_id, req.auth!.userId, req.params.restorationId, parsed.data.reason,
        { disposition: parsed.data.disposition, complianceReference: parsed.data.complianceReference ?? null, volumeMl: Number(current.rows[0].volume_ml), saleableStockChanged: false }]
    );
    await client.query('COMMIT');
    return res.json({ data: updated.rows[0], saleableStockChanged: false });
  } catch (error) {
    await client.query('ROLLBACK'); throw error;
  } finally { client.release(); }
});

settlementsRouter.post('/shifts/:shiftId/cash-movements', requirePermission('shift:manage'), async(req,res)=>{
 const s=z.object({direction:z.enum(['IN','OUT']),amount:z.number().positive(),reason:z.string().trim().min(3).max(1000),reference:z.string().max(160).optional()}).safeParse(req.body);
 if(!s.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:s.error.flatten()}});
 const client=await pool.connect(); const org=req.auth!.organisationId!;
 try{await client.query('BEGIN'); const shift=await client.query('SELECT * FROM outlet_shifts WHERE id=$1 AND organisation_id=$2 FOR UPDATE',[req.params.shiftId,org]);
 if(!shift.rowCount){await client.query('ROLLBACK');return res.status(404).json({error:{code:'SHIFT_NOT_FOUND'}});}
 if(shift.rows[0].status!=='OPEN'){await client.query('ROLLBACK');return res.status(409).json({error:{code:'SHIFT_NOT_OPEN'}});}
 const r=await client.query(`INSERT INTO shift_cash_movements(organisation_id,outlet_id,shift_id,direction,amount,reason,reference,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[org,shift.rows[0].outlet_id,req.params.shiftId,s.data.direction,s.data.amount,s.data.reason,s.data.reference??null,req.auth!.userId]);
 await client.query(`INSERT INTO shift_events(shift_id,event_type,payload,actor_id) VALUES($1,'CASH_MOVEMENT',$2,$3)`,[req.params.shiftId,{direction:s.data.direction,amount:s.data.amount,reason:s.data.reason},req.auth!.userId]);
 await client.query('COMMIT');return res.status(201).json({data:r.rows[0]});
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
});

settlementsRouter.get('/shifts/:shiftId/cash-movements', requirePermission('shift:read'), async(req,res)=>{
 const r=await pool.query('SELECT * FROM shift_cash_movements WHERE shift_id=$1 AND organisation_id=$2 ORDER BY created_at',[req.params.shiftId,req.auth!.organisationId]); return res.json({data:r.rows});
});
