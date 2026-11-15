import { Router } from 'express';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { appendStockMovementOnce } from '../services/stockMovementIdempotency.js';
import { consumeInventoryCostFifo } from '../services/inventoryCosting.js';
import { authenticate } from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { requireOrgScope } from '../middleware/requireOrgScope.js';
import { checkOutletOperationalAccess } from '../services/outletOperationalAccess.js';
import { createBarCheckoutFingerprint } from '../services/barCheckoutIntegrity.js';
import { evaluateExciseSale } from '../services/exciseCompliance.js';
import { createCheckoutTaxQuote } from '../services/taxQuote.js';
import { calculateBarSettlement, createBarSettlementFingerprint } from '../services/barTabSettlement.js';
import { addInventoryCostLayer } from '../services/inventoryCosting.js';
import { scaleRecipeQuantity } from '../services/barRecipe.js';
import { consumeInventoryBatchFefo, restoreInventoryBatchFefo } from '../services/inventoryBatchFefo.js';

export const barCheckoutRouter = Router();
barCheckoutRouter.use(authenticate, requireOrgScope);

const uuid = z.string().uuid();
const lineSchema = z.object({
  productId: uuid,
  lineType: z.enum(['PEG', 'BOTTLE', 'PACKAGED']),
  quantity: z.number().positive(),
  volumeMl: z.number().int().positive().optional(),
  openBottleId: uuid.optional(),
  modifierOptionIds: z.array(uuid).max(20).default([])
    .refine(ids=>new Set(ids).size===ids.length,'Modifier options cannot be repeated')
}).superRefine((line, ctx) => {
  if (line.lineType === 'PEG') {
    if (!Number.isInteger(line.quantity)) ctx.addIssue({ code: 'custom', message: 'Peg quantity must be a whole number', path: ['quantity'] });
    if (!line.volumeMl) ctx.addIssue({ code: 'custom', message: 'Peg volume is required', path: ['volumeMl'] });
    if (!line.openBottleId) ctx.addIssue({ code: 'custom', message: 'Open bottle is required for peg service', path: ['openBottleId'] });
  } else {
    if (!Number.isInteger(line.quantity)) ctx.addIssue({ code: 'custom', message: 'Bottle and packaged quantities must be whole numbers', path: ['quantity'] });
    if (line.volumeMl || line.openBottleId) ctx.addIssue({ code: 'custom', message: 'Bottle and packaged lines cannot reference an open bottle or measure', path: ['openBottleId'] });
  }
});

const checkoutSchema = z.object({
  outletId: uuid,
  idempotencyKey: z.string().min(8).max(100),
  ticketNumber: z.string().min(1).max(60),
  tableLabel: z.string().max(40).optional(),
  tableSessionId: uuid.optional(),
  lines: z.array(lineSchema).min(1),
  payments: z.array(z.object({
    method: z.enum(['CASH', 'UPI', 'CARD', 'WALLET', 'OTHER']),
    amount: z.number().positive(),
    reference: z.string().max(160).optional()
  })).default([]),
  complianceAttestations: z.object({ ageVerified: z.literal(true), notIntoxicated: z.literal(true), noRestrictedCustomer: z.literal(true), mealProvided: z.literal(true), consumptionOnPremises: z.literal(true).optional() })
}).superRefine((checkout, ctx) => {
  if (!checkout.payments.length && !checkout.tableSessionId) {
    ctx.addIssue({ code: 'custom', path: ['payments'], message: 'Unpaid bar orders must belong to an open table session' });
  }
});

const approvalRequestSchema=z.discriminatedUnion('type',[
  z.object({type:z.literal('VOID'),idempotencyKey:z.string().trim().min(16).max(160),reason:z.string().trim().min(3).max(500)}),
  z.object({
    type:z.literal('REFUND'),idempotencyKey:z.string().trim().min(16).max(160),
    amount:z.number().positive(),reason:z.string().trim().min(3).max(1000),
    method:z.enum(['CASH','UPI','CARD','WALLET','OTHER']),reference:z.string().max(160).optional(),
    pegRestorations:z.array(z.object({ticketLineId:uuid,volumeMl:z.number().int().positive()})).default([])
  }),
  z.object({
    type:z.enum(['DISCOUNT','COMP','TIP','SERVICE_CHARGE']),
    idempotencyKey:z.string().trim().min(16).max(160),
    amount:z.number().positive().finite().refine((amount)=>Math.abs(amount*100-Math.round(amount*100))<1e-8),
    reason:z.string().trim().min(3).max(500),
    customerConfirmed:z.boolean().optional()
  })
]);

export function calculateBarTotals(lines: Array<{ quantity: number; unitPrice: number; baseAmount?: number; taxRate?: number; taxAmount?: number; lineTotal?: number }>) {
  let subtotal = 0;
  let taxTotal = 0;
  let grandTotal = 0;
  for (const line of lines) {
    const base = line.baseAmount ?? line.quantity * line.unitPrice;
    const tax = line.taxAmount ?? Math.round((base * (line.taxRate ?? 0) / 100 + Number.EPSILON) * 100) / 100;
    subtotal += base;
    taxTotal += tax;
    grandTotal += line.lineTotal ?? base + tax;
  }
  subtotal = Math.round((subtotal + Number.EPSILON) * 100) / 100;
  taxTotal = Math.round((taxTotal + Number.EPSILON) * 100) / 100;
  return { subtotal, taxTotal, grandTotal: Math.round((grandTotal + Number.EPSILON) * 100) / 100 };
}

barCheckoutRouter.get('/bar/tickets', requirePermission('bar:read'), async (req,res) => {
  const outletId=typeof req.query.outletId==='string'?req.query.outletId:null;
  if(outletId&&!uuid.safeParse(outletId).success)return res.status(400).json({error:{code:'INVALID_OUTLET_ID'}});
  const requested=Number(req.query.limit??50);
  const limit=Number.isFinite(requested)?Math.min(Math.max(Math.floor(requested),1),200):50;
  const result=await pool.query(
    `SELECT t.*,COALESCE((SELECT SUM(r.amount) FROM bar_refunds r WHERE r.ticket_id=t.id),0) refunded_total
       FROM bar_tickets t WHERE t.organisation_id=$1 AND ($2::uuid IS NULL OR t.outlet_id=$2)
       ORDER BY t.opened_at DESC LIMIT $3`,
    [req.auth!.organisationId!,outletId,limit]
  );
  return res.json({data:result.rows});
});

barCheckoutRouter.get('/bar/tickets/:ticketId', requirePermission('bar:read'), async (req,res) => {
  const ticket=await pool.query(
    `SELECT t.*,COALESCE((SELECT SUM(p.amount) FROM bar_payments p WHERE p.ticket_id=t.id),0) paid_total,
       GREATEST(t.grand_total-COALESCE((SELECT SUM(p.amount) FROM bar_payments p WHERE p.ticket_id=t.id),0),0) balance_due
       FROM bar_tickets t WHERE t.id=$1 AND t.organisation_id=$2`,
    [req.params.ticketId,req.auth!.organisationId]
  );
  if(!ticket.rowCount)return res.status(404).json({error:{code:'TICKET_NOT_FOUND'}});
  const [lines,payments,refunds]=await Promise.all([
    pool.query(`SELECT l.*,COALESCE((SELECT SUM(x.volume_ml) FROM bar_refund_peg_restorations x WHERE x.ticket_line_id=l.id),0) quarantined_volume_ml,
       COALESCE((SELECT json_agg(json_build_object(
         'id',m.id,'groupId',m.group_id,'groupName',m.group_name,'optionId',m.option_id,
         'name',m.option_name,'priceDelta',m.price_delta,'substitutesProductId',m.substitutes_product_id,
         'ingredientProductId',m.ingredient_product_id,
         'ingredientQuantity',m.ingredient_quantity
       ) ORDER BY m.id) FROM bar_ticket_line_modifiers m WHERE m.ticket_line_id=l.id),'[]'::json) modifiers
      FROM bar_ticket_lines l WHERE l.ticket_id=$1 AND l.quantity>0 ORDER BY l.id`,[req.params.ticketId]),
    pool.query('SELECT method,amount,reference FROM bar_payments WHERE ticket_id=$1 ORDER BY created_at,id',[req.params.ticketId]),
    pool.query('SELECT * FROM bar_refunds WHERE ticket_id=$1 ORDER BY created_at,id',[req.params.ticketId])
  ]);
  return res.json({data:{...ticket.rows[0],lines:lines.rows,payments:payments.rows,refunds:refunds.rows}});
});

barCheckoutRouter.post('/bar/tickets/:ticketId/payments', requirePermission('bar:sell'), async (req,res) => {
  const parsed=z.object({
    idempotencyKey:z.string().trim().min(16).max(160),
    payments:z.array(z.object({
      method:z.enum(['CASH','UPI','CARD','WALLET','OTHER']),
      amount:z.number().positive().finite().refine((amount)=>Math.abs(amount*100-Math.round(amount*100))<1e-8,'Amount must be in whole cents'),
      reference:z.string().trim().max(160).optional()
    })).min(1).max(10)
  }).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:parsed.error.flatten()}});
  const org=req.auth!.organisationId!;
  const fingerprint=createBarSettlementFingerprint(String(req.params.ticketId),parsed.data.payments);
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const ticket=await client.query(
      'SELECT * FROM bar_tickets WHERE id=$1 AND organisation_id=$2 FOR UPDATE',
      [req.params.ticketId,org]
    );
    if(!ticket.rowCount){await client.query('ROLLBACK');return res.status(404).json({error:{code:'TICKET_NOT_FOUND'}});}
    const access=await checkOutletOperationalAccess(client,org,ticket.rows[0].outlet_id,'BAR_SERVICE',{
      userId:req.auth!.userId,roleCode:req.auth!.roleCode
    });

    if(!access.allowed){
      await client.query('ROLLBACK');
      return res.status(403).json({error:{code:access.code,message:access.message}});
    }
    const existing=await client.query(
      'SELECT * FROM bar_payment_requests WHERE organisation_id=$1 AND ticket_id=$2 AND idempotency_key=$3',
      [org,req.params.ticketId,parsed.data.idempotencyKey]
    );
    if(existing.rowCount){
      if(existing.rows[0].request_fingerprint!==fingerprint){
        await client.query('ROLLBACK');
        return res.status(409).json({error:{code:'IDEMPOTENCY_KEY_REUSED',message:'This key was already used for a different payment request'}});
      }
      const [sums,replayedPayments]=await Promise.all([
        client.query('SELECT COALESCE(SUM(amount),0) paid_total FROM bar_payments WHERE ticket_id=$1',[req.params.ticketId]),
        client.query('SELECT * FROM bar_payments WHERE ticket_id=$1 AND idempotency_key=$2 ORDER BY created_at,id',[req.params.ticketId,parsed.data.idempotencyKey])
      ]);
      const paidTotal=Number(sums.rows[0].paid_total);
      await client.query('COMMIT');
      return res.json({data:replayedPayments.rows,paidTotal,remainingDue:Math.max(0,Number(ticket.rows[0].grand_total)-paidTotal),status:ticket.rows[0].status,idempotentReplay:true});
    }
    const activeProviderOrder=await client.query(
      `SELECT 1 FROM p597_razorpay_bar_tab_orders
        WHERE organisation_id=$1 AND ticket_id=$2 AND status IN ('CREATING','CREATED','REVIEW_REQUIRED')
        LIMIT 1`,
      [org,req.params.ticketId]
    );
    if(activeProviderOrder.rowCount){
      await client.query('ROLLBACK');
      return res.status(409).json({error:{code:'RAZORPAY_PAYMENT_IN_PROGRESS',message:'Finish or resolve the active Razorpay payment before recording another tender'}});
    }
    if(!['SENT','PART_PAID'].includes(ticket.rows[0].status)){
      await client.query('ROLLBACK');
      return res.status(409).json({error:{code:'TICKET_NOT_OPEN_FOR_PAYMENT',message:'Only an unpaid or partially paid tab ticket can receive additional payment'}});
    }
    const sums=await client.query('SELECT COALESCE(SUM(amount),0) paid_total FROM bar_payments WHERE ticket_id=$1',[req.params.ticketId]);
    let settlement;
    try{
      settlement=calculateBarSettlement(Number(ticket.rows[0].grand_total),Number(sums.rows[0].paid_total),parsed.data.payments);
    }catch(error){
      await client.query('ROLLBACK');
      const code=error instanceof Error?error.message:'INVALID_TICKET_BALANCE';
      return res.status(409).json({error:{code,message:code==='PAYMENT_EXCEEDS_BALANCE'?'Payment exceeds the ticket balance':'Ticket balance is invalid'}});
    }
    await client.query(
      `INSERT INTO bar_payment_requests(organisation_id,ticket_id,idempotency_key,request_fingerprint,created_by)
       VALUES($1,$2,$3,$4,$5)`,
      [org,req.params.ticketId,parsed.data.idempotencyKey,fingerprint,req.auth!.userId]
    );
    const inserted=[];
    for(const payment of parsed.data.payments){
      const result=await client.query(
        `INSERT INTO bar_payments(organisation_id,ticket_id,method,amount,reference,idempotency_key,request_fingerprint)
         VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [org,req.params.ticketId,payment.method,payment.amount,payment.reference??null,parsed.data.idempotencyKey,fingerprint]
      );
      inserted.push(result.rows[0]);
    }
    await client.query(
      `UPDATE bar_tickets SET status=$1,closed_at=CASE WHEN $1='PAID' THEN NOW() ELSE NULL END WHERE id=$2`,
      [settlement.status,req.params.ticketId]
    );
    await client.query(
      `INSERT INTO audit_events(organisation_id,outlet_id,actor_user_id,event_type,entity_type,entity_id,metadata)
       VALUES($1,$2,$3,'BAR_TAB_PAYMENT_RECORDED','BAR_TICKET',$4,$5)`,
      [org,ticket.rows[0].outlet_id,req.auth!.userId,req.params.ticketId,{
        paymentCount:inserted.length,paymentAmount:Math.round(parsed.data.payments.reduce((sum,p)=>sum+p.amount,0)*100)/100,
        paidTotal:settlement.paidTotal,remainingDue:settlement.remainingDue,status:settlement.status
      }]
    );
    await client.query('COMMIT');
    return res.status(201).json({data:inserted,paidTotal:settlement.paidTotal,remainingDue:settlement.remainingDue,status:settlement.status,idempotentReplay:false});
  }catch(error:any){
    await client.query('ROLLBACK');
    throw error;
  }finally{client.release();}
});

/**
 * Atomic bar checkout: validates licence, resolves server-side prices, consumes stock/ml,
 * writes ticket lines and payments, and records an audit event in one DB transaction.
 */

barCheckoutRouter.post('/bar/tickets/:ticketId/lines/:lineId/quantity', requirePermission('bar:sell'), async(req,res) => {
  const parsed=z.object({
    idempotencyKey:z.string().trim().min(16).max(160),
    quantity:z.number().int().min(0).max(1000),
    reason:z.string().trim().min(3).max(500)
  }).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:parsed.error.flatten()}});
  const org=req.auth!.organisationId!;
  const fingerprint=createHash('sha256').update(JSON.stringify([
    String(req.params.ticketId).toLowerCase(),String(req.params.lineId).toLowerCase(),
    parsed.data.quantity,parsed.data.reason
  ])).digest('hex');
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const ticket=await client.query(
      'SELECT * FROM bar_tickets WHERE id=$1 AND organisation_id=$2 FOR UPDATE',
      [req.params.ticketId,org]
    );
    if(!ticket.rowCount){await client.query('ROLLBACK');return res.status(404).json({error:{code:'TICKET_NOT_FOUND'}});}
    const access=await checkOutletOperationalAccess(client,org,ticket.rows[0].outlet_id,'BAR_SERVICE',{
      userId:req.auth!.userId,roleCode:req.auth!.roleCode
    });
    if(!access.allowed){
      await client.query('ROLLBACK');
      return res.status(403).json({error:{code:access.code,message:access.message}});
    }
    const prior=await client.query(
      `SELECT request_fingerprint FROM bar_ticket_line_edit_requests
       WHERE organisation_id=$1 AND ticket_id=$2 AND idempotency_key=$3 FOR UPDATE`,
      [org,req.params.ticketId,parsed.data.idempotencyKey]
    );
    if(prior.rowCount){
      if(prior.rows[0].request_fingerprint!==fingerprint){
        await client.query('ROLLBACK');
        return res.status(409).json({error:{code:'IDEMPOTENCY_KEY_REUSED'}});
      }
      const current=await client.query(
        'SELECT * FROM bar_tickets WHERE id=$1 AND organisation_id=$2',
        [req.params.ticketId,org]
      );
      await client.query('COMMIT');
      return res.json({data:current.rows[0],idempotentReplay:true});
    }
    if(ticket.rows[0].status!=='SENT'){
      await client.query('ROLLBACK');
      return res.status(409).json({error:{code:'TICKET_NOT_EDITABLE',message:'Only unpaid, unvoided tab tickets can be edited'}});
    }
    const [payments,refunds,kot,line]=await Promise.all([
      client.query('SELECT 1 FROM bar_payments WHERE ticket_id=$1 LIMIT 1',[req.params.ticketId]),
      client.query('SELECT 1 FROM bar_refunds WHERE ticket_id=$1 LIMIT 1',[req.params.ticketId]),
      client.query(
        `SELECT k.id,k.status FROM bar_kot_orders k
          JOIN bar_kot_lines kl ON kl.kot_order_id=k.id
         WHERE k.ticket_id=$1 AND kl.ticket_line_id=$2
         FOR UPDATE OF k`,
        [req.params.ticketId,req.params.lineId]
      ),
      client.query('SELECT * FROM bar_ticket_lines WHERE id=$1 AND ticket_id=$2 FOR UPDATE',[req.params.lineId,req.params.ticketId])
    ]);
    if(payments.rowCount||refunds.rowCount){
      await client.query('ROLLBACK');
      return res.status(409).json({error:{code:'TICKET_HAS_FINANCIAL_ACTIVITY'}});
    }
    if(kot.rowCount!==1||kot.rows[0].status!=='NEW'){
      await client.query('ROLLBACK');
      return res.status(409).json({error:{code:'KOT_ALREADY_IN_PREPARATION',message:'Ticket lines can only be edited before preparation starts'}});
    }
    if(!line.rowCount||Number(line.rows[0].quantity)<=0){
      await client.query('ROLLBACK');
      return res.status(404).json({error:{code:'TICKET_LINE_NOT_FOUND'}});
    }
    if(line.rows[0].line_type!=='PACKAGED'||!line.rows[0].stock_movement_id){
      await client.query('ROLLBACK');
      return res.status(409).json({error:{code:'LINE_EDIT_NOT_SUPPORTED',message:'Only packaged stock lines can be edited; open-bottle pours require the authorised refund/quarantine workflow'}});
    }
    const previousQuantity=Number(line.rows[0].quantity);
    if(parsed.data.quantity===previousQuantity){
      await client.query('ROLLBACK');
      return res.status(400).json({error:{code:'QUANTITY_UNCHANGED'}});
    }
    const activeLineCount=await client.query(
      'SELECT COUNT(*)::int count FROM bar_ticket_lines WHERE ticket_id=$1 AND quantity>0',
      [req.params.ticketId]
    );
    if(parsed.data.quantity===0&&Number(activeLineCount.rows[0].count)<=1){
      await client.query('ROLLBACK');
      return res.status(409).json({error:{code:'LAST_TICKET_LINE',message:'Remove the final line by voiding the complete unpaid ticket'}});
    }
    const edit=await client.query(
      `INSERT INTO bar_ticket_line_edit_requests(
         organisation_id,outlet_id,ticket_id,ticket_line_id,idempotency_key,request_fingerprint,
         previous_quantity,requested_quantity,reason,edited_by
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [org,ticket.rows[0].outlet_id,req.params.ticketId,req.params.lineId,parsed.data.idempotencyKey,
        fingerprint,previousQuantity,parsed.data.quantity,parsed.data.reason,req.auth!.userId]
    );
    const delta=parsed.data.quantity-previousQuantity;
    if(delta>0){
      const stock=await client.query(
        `UPDATE stock_balances SET quantity_units=quantity_units-$1,updated_at=NOW()
         WHERE organisation_id=$2 AND outlet_id=$3 AND product_id=$4 AND quantity_units >= $1
         RETURNING quantity_units`,
        [delta,org,ticket.rows[0].outlet_id,line.rows[0].product_id]
      );
      if(!stock.rowCount){
        await client.query('ROLLBACK');
        return res.status(409).json({error:{code:'INSUFFICIENT_STOCK',message:'Not enough packaged stock to increase this ticket line'}});
      }
      const movement=await appendStockMovementOnce(client,{
        organisationId:org,outletId:ticket.rows[0].outlet_id,productId:line.rows[0].product_id,
        movementType:'SALE',quantityUnits:delta,referenceType:'BAR_TICKET_LINE_EDIT',
        referenceId:String(req.params.ticketId),idempotencyKey:`bar-line-edit:${edit.rows[0].id}:sale`,
        notes:parsed.data.reason,createdBy:req.auth!.userId
      });
      if(!movement.created)throw new Error('BAR_LINE_EDIT_MOVEMENT_EXISTS_BEFORE_COMMIT');
      await consumeInventoryBatchFefo(client,{
        organisationId:org,outletId:ticket.rows[0].outlet_id,productId:line.rows[0].product_id,
        stockMovementId:movement.id,quantityUnits:delta
      });
      await consumeInventoryCostFifo(client,{
        organisationId:org,outletId:ticket.rows[0].outlet_id,productId:line.rows[0].product_id,
        quantityUnits:delta,sourceType:'BAR_TICKET_LINE_EDIT',sourceId:movement.id,movementId:movement.id
      });
      await client.query(
        `INSERT INTO bar_ticket_line_stock_adjustments(
           organisation_id,outlet_id,ticket_id,ticket_line_id,edit_request_id,movement_id,direction,quantity_units
         ) VALUES($1,$2,$3,$4,$5,$6,'SALE',$7)`,
        [org,ticket.rows[0].outlet_id,req.params.ticketId,req.params.lineId,edit.rows[0].id,movement.id,delta]
      );
    }else{
      const returnedQuantity=Math.abs(delta);
      const stock=await client.query(
        `UPDATE stock_balances SET quantity_units=quantity_units+$1,updated_at=NOW()
         WHERE organisation_id=$2 AND outlet_id=$3 AND product_id=$4 RETURNING quantity_units`,
        [returnedQuantity,org,ticket.rows[0].outlet_id,line.rows[0].product_id]
      );
      if(!stock.rowCount){
        await client.query('ROLLBACK');
        return res.status(409).json({error:{code:'STOCK_BALANCE_MISSING'}});
      }
      const movement=await appendStockMovementOnce(client,{
        organisationId:org,outletId:ticket.rows[0].outlet_id,productId:line.rows[0].product_id,
        movementType:'RETURN',quantityUnits:returnedQuantity,referenceType:'BAR_TICKET_LINE_EDIT',
        referenceId:String(req.params.ticketId),idempotencyKey:`bar-line-edit:${edit.rows[0].id}:return`,
        notes:parsed.data.reason,createdBy:req.auth!.userId
      });
      if(!movement.created)throw new Error('BAR_LINE_EDIT_RETURN_MOVEMENT_EXISTS_BEFORE_COMMIT');
      const saleMovements=await client.query(
        `SELECT movement_id FROM bar_ticket_line_stock_adjustments
         WHERE ticket_line_id=$1 AND direction='SALE'
         UNION SELECT stock_movement_id FROM bar_ticket_lines WHERE id=$1 AND stock_movement_id IS NOT NULL`,
        [req.params.lineId]
      );
      await restoreInventoryBatchFefo(client,{
        organisationId:org,outletId:ticket.rows[0].outlet_id,productId:line.rows[0].product_id,
        sourceMovementIds:saleMovements.rows.map((row:any)=>row.movement_id),
        returnMovementId:movement.id,quantityUnits:returnedQuantity
      });
      const cost=await client.query(
        `SELECT COALESCE(SUM(quantity_units),0) quantity,COALESCE(SUM(extended_cost),0) cost
         FROM inventory_cost_consumptions WHERE movement_id=ANY($1::uuid[])`,
        [saleMovements.rows.map((row:any)=>row.movement_id)]
      );
      if(Number(cost.rows[0].quantity)+0.0005<returnedQuantity){
        await client.query('ROLLBACK');
        return res.status(409).json({error:{code:'COST_REVERSAL_EVIDENCE_MISSING',message:'Cannot reduce this line without complete FIFO cost evidence'}});
      }
      const unitCost=Number(cost.rows[0].cost)/Number(cost.rows[0].quantity);
      await addInventoryCostLayer(client,{
        organisationId:org,outletId:ticket.rows[0].outlet_id,productId:line.rows[0].product_id,
        sourceType:'RETURN',sourceId:movement.id,sourceLineId:randomUUID(),
        quantityUnits:returnedQuantity,unitCost
      });
      await client.query(
        `INSERT INTO bar_ticket_line_stock_adjustments(
           organisation_id,outlet_id,ticket_id,ticket_line_id,edit_request_id,movement_id,direction,quantity_units
         ) VALUES($1,$2,$3,$4,$5,$6,'RETURN',$7)`,
        [org,ticket.rows[0].outlet_id,req.params.ticketId,req.params.lineId,edit.rows[0].id,movement.id,returnedQuantity]
      );
    }
    const ratio=parsed.data.quantity/previousQuantity;
    const base=Number(line.rows[0].line_total)-Number(line.rows[0].tax_amount);
    const taxAmount=Math.round((Number(line.rows[0].tax_amount)*ratio+Number.EPSILON)*100)/100;
    const lineTotal=Math.round((base*ratio+taxAmount+Number.EPSILON)*100)/100;
    await client.query(
      `UPDATE bar_ticket_lines SET quantity=$1,tax_amount=$2,line_total=$3 WHERE id=$4`,
      [parsed.data.quantity,taxAmount,lineTotal,req.params.lineId]
    );
    if(parsed.data.quantity===0){
      await client.query('DELETE FROM bar_kot_lines WHERE kot_order_id=$1 AND ticket_line_id=$2',[kot.rows[0].id,req.params.lineId]);
    }else{
      await client.query('UPDATE bar_kot_lines SET quantity=$1 WHERE kot_order_id=$2 AND ticket_line_id=$3',
        [parsed.data.quantity,kot.rows[0].id,req.params.lineId]);
    }
    const totals=await client.query(
      `SELECT COALESCE(SUM(line_total-tax_amount),0)::numeric(14,2) subtotal,
              COALESCE(SUM(tax_amount),0)::numeric(14,2) tax_total,
              COALESCE(SUM(line_total),0)::numeric(14,2) grand_total
       FROM bar_ticket_lines WHERE ticket_id=$1 AND quantity>0`,
      [req.params.ticketId]
    );
    const updated=await client.query(
      `UPDATE bar_tickets SET subtotal=$1,tax_total=$2,grand_total=$3
       WHERE id=$4 AND organisation_id=$5 RETURNING *`,
      [totals.rows[0].subtotal,totals.rows[0].tax_total,totals.rows[0].grand_total,req.params.ticketId,org]
    );
    await client.query(
      `INSERT INTO audit_events(organisation_id,outlet_id,actor_user_id,event_type,entity_type,entity_id,reason,metadata)
       VALUES($1,$2,$3,'BAR_TAB_LINE_QUANTITY_CHANGED','BAR_TICKET',$4,$5,$6)`,
      [org,ticket.rows[0].outlet_id,req.auth!.userId,req.params.ticketId,parsed.data.reason,{
        ticketLineId:req.params.lineId,previousQuantity,requestedQuantity:parsed.data.quantity,
        stockAdjustment:delta,editRequestId:edit.rows[0].id
      }]
    );
    await client.query('COMMIT');
    return res.status(200).json({data:updated.rows[0],idempotentReplay:false});
  }catch(error:any){
    await client.query('ROLLBACK');
    if(typeof error?.code==='string'&&error.code.startsWith('INVENTORY_BATCH_'))return res.status(409).json({error:{code:error.code,message:error.message}});
    throw error;
  }finally{client.release();}
});

barCheckoutRouter.post('/bar/tickets/:ticketId/split', requirePermission('bar:sell'), async (req,res) => {
  const parsed=z.object({
    idempotencyKey:z.string().trim().min(16).max(160),
    lineIds:z.array(uuid).min(1).max(100).refine((ids)=>new Set(ids).size===ids.length,'Ticket lines must be unique')
  }).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:parsed.error.flatten()}});
  const org=req.auth!.organisationId!;
  const fingerprint=createHash('sha256').update(JSON.stringify([
    String(req.params.ticketId).toLowerCase(),
    parsed.data.lineIds.map((id)=>id.toLowerCase()).sort()
  ])).digest('hex');
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const source=await client.query(
      'SELECT * FROM bar_tickets WHERE id=$1 AND organisation_id=$2 FOR UPDATE',
      [req.params.ticketId,org]
    );
    if(!source.rowCount){await client.query('ROLLBACK');return res.status(404).json({error:{code:'TICKET_NOT_FOUND'}});}
    const access=await checkOutletOperationalAccess(client,org,source.rows[0].outlet_id,'BAR_SERVICE',{
      userId:req.auth!.userId,roleCode:req.auth!.roleCode
    });
    if(!access.allowed){
      await client.query('ROLLBACK');
      return res.status(403).json({error:{code:access.code,message:access.message}});
    }
    const prior=await client.query(
      `SELECT request_fingerprint,created_ticket_id FROM bar_ticket_split_requests
       WHERE organisation_id=$1 AND source_ticket_id=$2 AND idempotency_key=$3 FOR UPDATE`,
      [org,req.params.ticketId,parsed.data.idempotencyKey]
    );
    if(prior.rowCount){
      if(prior.rows[0].request_fingerprint!==fingerprint){
        await client.query('ROLLBACK');
        return res.status(409).json({error:{code:'IDEMPOTENCY_KEY_REUSED',message:'This split key was already used with different ticket lines'}});
      }
      const child=await client.query('SELECT * FROM bar_tickets WHERE id=$1 AND organisation_id=$2',[prior.rows[0].created_ticket_id,org]);
      await client.query('COMMIT');
      return res.json({data:child.rows[0],sourceTicketId:req.params.ticketId,idempotentReplay:true});
    }
    if(source.rows[0].status!=='SENT'){
      await client.query('ROLLBACK');
      return res.status(409).json({error:{code:'TICKET_NOT_SPLITTABLE',message:'Only unpaid, unvoided tab tickets can be split'}});
    }
    const [payments,refunds,pendingKot,lines]=await Promise.all([
      client.query('SELECT 1 FROM bar_payments WHERE ticket_id=$1 LIMIT 1',[req.params.ticketId]),
      client.query('SELECT 1 FROM bar_refunds WHERE ticket_id=$1 LIMIT 1',[req.params.ticketId]),
      client.query("SELECT 1 FROM bar_kot_orders WHERE ticket_id=$1 AND status NOT IN ('SERVED','CANCELLED') LIMIT 1",[req.params.ticketId]),
      client.query('SELECT id,line_total,tax_amount FROM bar_ticket_lines WHERE ticket_id=$1 AND quantity>0 ORDER BY id FOR UPDATE',[req.params.ticketId])
    ]);
    if(payments.rowCount||refunds.rowCount){
      await client.query('ROLLBACK');
      return res.status(409).json({error:{code:'TICKET_HAS_FINANCIAL_ACTIVITY',message:'A ticket with payments or refunds cannot be split'}});
    }
    if(pendingKot.rowCount){
      await client.query('ROLLBACK');
      return res.status(409).json({error:{code:'KOT_NOT_COMPLETE',message:'All preparation tickets must be served or cancelled before splitting a bill'}});
    }
    const selectedIds=new Set(parsed.data.lineIds);
    const selected=lines.rows.filter((line:any)=>selectedIds.has(line.id));
    const remaining=lines.rows.filter((line:any)=>!selectedIds.has(line.id));
    if(selected.length!==selectedIds.size||remaining.length===0){
      await client.query('ROLLBACK');
      return res.status(400).json({error:{code:'INVALID_SPLIT_LINES',message:'Select existing ticket lines and leave at least one line on the original bill'}});
    }
    const totals=(rows:any[])=>{
      const taxTotal=rows.reduce((sum,line)=>sum+Number(line.tax_amount),0);
      const grandTotal=rows.reduce((sum,line)=>sum+Number(line.line_total),0);
      return {
        subtotal:Math.round((grandTotal-taxTotal+Number.EPSILON)*100)/100,
        taxTotal:Math.round((taxTotal+Number.EPSILON)*100)/100,
        grandTotal:Math.round((grandTotal+Number.EPSILON)*100)/100
      };
    };
    const movedTotals=totals(selected);
    const remainingTotals=totals(remaining);
    const childTicketNumber=`${String(source.rows[0].ticket_number).slice(0,47)}-S-${randomUUID().slice(0,8)}`;
    const child=await client.query(
      `INSERT INTO bar_tickets(
         organisation_id,outlet_id,ticket_number,table_label,table_session_id,status,
         subtotal,tax_total,discount_total,grand_total,opened_by
       ) VALUES($1,$2,$3,$4,$5,'SENT',$6,$7,0,$8,$9) RETURNING *`,
      [org,source.rows[0].outlet_id,childTicketNumber,source.rows[0].table_label,
        source.rows[0].table_session_id,movedTotals.subtotal,movedTotals.taxTotal,
        movedTotals.grandTotal,req.auth!.userId]
    );
    await client.query(
      'UPDATE bar_ticket_lines SET ticket_id=$1 WHERE ticket_id=$2 AND id=ANY($3::uuid[])',
      [child.rows[0].id,req.params.ticketId,parsed.data.lineIds]
    );
    await client.query(
      `UPDATE bar_tickets SET subtotal=$1,tax_total=$2,grand_total=$3
       WHERE id=$4 AND organisation_id=$5`,
      [remainingTotals.subtotal,remainingTotals.taxTotal,remainingTotals.grandTotal,req.params.ticketId,org]
    );
    await client.query(
      `INSERT INTO bar_ticket_split_requests(
         organisation_id,outlet_id,source_ticket_id,created_ticket_id,idempotency_key,request_fingerprint,created_by
       ) VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [org,source.rows[0].outlet_id,req.params.ticketId,child.rows[0].id,
        parsed.data.idempotencyKey,fingerprint,req.auth!.userId]
    );
    await client.query(
      `INSERT INTO audit_events(organisation_id,outlet_id,actor_user_id,event_type,entity_type,entity_id,reason,metadata)
       VALUES($1,$2,$3,'BAR_TAB_ITEMS_SPLIT','BAR_TICKET',$4,$5,$6)`,
      [org,source.rows[0].outlet_id,req.auth!.userId,req.params.ticketId,
        'Unpaid tab items assigned to a separate bill',
        {sourceTicketId:req.params.ticketId,createdTicketId:child.rows[0].id,lineIds:parsed.data.lineIds,
          sourceTotal:remainingTotals.grandTotal,splitTotal:movedTotals.grandTotal}]
    );
    await client.query('COMMIT');
    return res.status(201).json({data:child.rows[0],sourceTicketId:req.params.ticketId,idempotentReplay:false});
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
});

barCheckoutRouter.post('/bar/tickets/:ticketId/approval-requests', requirePermission('bar:sell'), async(req,res) => {
  const parsed=approvalRequestSchema.safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:parsed.error.flatten()}});
  const org=req.auth!.organisationId!;
  const action=parsed.data.type;
  const fingerprint=createHash('sha256').update(JSON.stringify([
    String(req.params.ticketId).toLowerCase(),parsed.data
  ])).digest('hex');
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const ticket=await client.query(
      'SELECT * FROM bar_tickets WHERE id=$1 AND organisation_id=$2 FOR UPDATE',
      [req.params.ticketId,org]
    );
    if(!ticket.rowCount){await client.query('ROLLBACK');return res.status(404).json({error:{code:'TICKET_NOT_FOUND'}});}
    const access=await checkOutletOperationalAccess(client,org,ticket.rows[0].outlet_id,'BAR_SERVICE',{
      userId:req.auth!.userId,roleCode:req.auth!.roleCode
    });
    if(!access.allowed){
      await client.query('ROLLBACK');
      return res.status(403).json({error:{code:access.code,message:access.message}});
    }
    if(action==='VOID'||action==='REFUND'){
      const permission=await client.query(
        'SELECT 1 FROM role_permissions WHERE role_code=$1 AND permission_code=$2',
        [req.auth!.roleCode,'bar:refund']
      );
      if(!permission.rowCount){
        await client.query('ROLLBACK');
        return res.status(403).json({error:{code:'PERMISSION_DENIED',message:'bar:refund permission is required to request this control'}});
      }
    }
    const prior=await client.query(
      `SELECT * FROM bar_ticket_approval_requests
       WHERE organisation_id=$1 AND ticket_id=$2 AND request_type=$3 AND idempotency_key=$4 FOR UPDATE`,
      [org,req.params.ticketId,action,parsed.data.idempotencyKey]
    );
    if(prior.rowCount){
      if(prior.rows[0].request_fingerprint!==fingerprint){
        await client.query('ROLLBACK');
        return res.status(409).json({error:{code:'IDEMPOTENCY_KEY_REUSED'}});
      }
      await client.query('COMMIT');
      return res.json({data:prior.rows[0],idempotentReplay:true});
    }
    const ticketStatus=ticket.rows[0].status;
    if(['VOID','DISCOUNT','COMP','TIP','SERVICE_CHARGE'].includes(action)&&ticketStatus!=='SENT'){
      await client.query('ROLLBACK');
      return res.status(409).json({error:{code:'TICKET_NOT_ADJUSTABLE',message:'This adjustment is only available on an unpaid tab ticket'}});
    }
    if(action==='REFUND'&&ticketStatus!=='PAID'){
      await client.query('ROLLBACK');
      return res.status(409).json({error:{code:'TICKET_NOT_REFUNDABLE',message:'Only paid bar tickets can be refunded'}});
    }
    if(['DISCOUNT','COMP','TIP','SERVICE_CHARGE'].includes(action)){
      const payments=await client.query('SELECT 1 FROM bar_payments WHERE ticket_id=$1 LIMIT 1',[req.params.ticketId]);
      if(payments.rowCount){
        await client.query('ROLLBACK');
        return res.status(409).json({error:{code:'TICKET_HAS_FINANCIAL_ACTIVITY'}});
      }
      const body=parsed.data as z.infer<typeof approvalRequestSchema>;
      if((action==='TIP'||action==='SERVICE_CHARGE')&&body.type!=='VOID'&&body.type!=='REFUND'&&!body.customerConfirmed){
        await client.query('ROLLBACK');
        return res.status(400).json({error:{code:'CUSTOMER_CONFIRMATION_REQUIRED',message:'Tips and service charges must be explicitly confirmed by the customer'}});
      }
      if((action==='DISCOUNT'||action==='COMP')&&body.type!=='VOID'&&body.type!=='REFUND'
        &&body.amount>Number(ticket.rows[0].grand_total)+0.001){
        await client.query('ROLLBACK');
        return res.status(409).json({error:{code:'ADJUSTMENT_EXCEEDS_BALANCE'}});
      }
    }
    if(action==='VOID'){
      const completedPreparation=await client.query(
        `SELECT id FROM bar_kot_orders
          WHERE ticket_id=$1 AND status IN ('SERVED','CANCELLED') LIMIT 1`,
        [req.params.ticketId]
      );
      if(completedPreparation.rowCount){
        await client.query('ROLLBACK');
        return res.status(409).json({error:{code:'KOT_NOT_VOIDABLE',message:'Served or already-cancelled tickets must use the refund or escalation workflow'}});
      }
      const activeVoid=await client.query(
        `SELECT id FROM bar_ticket_approval_requests
          WHERE organisation_id=$1 AND ticket_id=$2 AND request_type='VOID'
            AND status IN ('PENDING','APPROVED') LIMIT 1 FOR UPDATE`,
        [org,req.params.ticketId]
      );
      if(activeVoid.rowCount){
        await client.query('ROLLBACK');
        return res.status(409).json({error:{code:'VOID_APPROVAL_ALREADY_ACTIVE',message:'A void request is already awaiting decision or execution for this ticket'}});
      }
    }
    const status=action==='TIP'||action==='SERVICE_CHARGE'?'EXECUTED':'PENDING';
    const created=await client.query(
      `INSERT INTO bar_ticket_approval_requests(
         organisation_id,outlet_id,ticket_id,request_type,idempotency_key,request_fingerprint,
         request_payload,status,requested_by,decided_by,decided_at,executed_at
       ) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,
         NULL,
         CASE WHEN $8='EXECUTED' THEN NOW() ELSE NULL END,
         CASE WHEN $8='EXECUTED' THEN NOW() ELSE NULL END)
       RETURNING *`,
      [org,ticket.rows[0].outlet_id,req.params.ticketId,action,parsed.data.idempotencyKey,
        fingerprint,JSON.stringify(parsed.data),status,req.auth!.userId]
    );
    if(status==='EXECUTED'&&(action==='TIP'||action==='SERVICE_CHARGE')){
      const body=parsed.data;
      if(body.type!=='TIP'&&body.type!=='SERVICE_CHARGE')throw new Error('INVALID_EXECUTED_BAR_ADJUSTMENT');
      await client.query(
        `INSERT INTO bar_ticket_adjustments(
           organisation_id,outlet_id,ticket_id,approval_request_id,adjustment_type,amount,reason,
           customer_confirmed,created_by
         ) VALUES($1,$2,$3,$4,$5,$6,$7,TRUE,$8)`,
        [org,ticket.rows[0].outlet_id,req.params.ticketId,created.rows[0].id,action,body.amount,body.reason,req.auth!.userId]
      );
      await client.query(
        'UPDATE bar_tickets SET grand_total=grand_total+$1 WHERE id=$2 AND organisation_id=$3',
        [body.amount,req.params.ticketId,org]
      );
    }
    await client.query(
      `INSERT INTO audit_events(organisation_id,outlet_id,actor_user_id,event_type,entity_type,entity_id,reason,metadata)
       VALUES($1,$2,$3,$4,'BAR_TICKET',$5,$6,$7)`,
      [org,ticket.rows[0].outlet_id,req.auth!.userId,status==='EXECUTED'?'BAR_TICKET_SURCHARGE_ADDED':'BAR_TICKET_APPROVAL_REQUESTED',
        req.params.ticketId,'reason' in parsed.data?parsed.data.reason:'', {approvalRequestId:created.rows[0].id,type:action,amount:'amount' in parsed.data?parsed.data.amount:null}]
    );
    await client.query('COMMIT');
    return res.status(201).json({data:created.rows[0],idempotentReplay:false});
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
});

barCheckoutRouter.get('/bar/ticket-approval-requests', requirePermission('bar:read'), async(req,res)=>{
  const outletId=typeof req.query.outletId==='string'?req.query.outletId:null;
  if(!outletId||!uuid.safeParse(outletId).success)return res.status(400).json({error:{code:'INVALID_OUTLET_ID'}});
  const result=await pool.query(
    `SELECT a.*,t.ticket_number,t.status ticket_status
     FROM bar_ticket_approval_requests a JOIN bar_tickets t ON t.id=a.ticket_id
     WHERE a.organisation_id=$1 AND a.outlet_id=$2 AND a.status IN ('PENDING','APPROVED','EXECUTED')
     ORDER BY a.created_at DESC LIMIT 100`,
    [req.auth!.organisationId!,outletId]
  );
  return res.json({data:result.rows});
});

barCheckoutRouter.post('/bar/ticket-approval-requests/:requestId/decision', requirePermission('bar:approve'), async(req,res)=>{
  const parsed=z.object({decision:z.enum(['APPROVE','REJECT']),reason:z.string().trim().min(3).max(500)}).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:parsed.error.flatten()}});
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const approval=await client.query(
      `SELECT * FROM bar_ticket_approval_requests
       WHERE id=$1 AND organisation_id=$2 FOR UPDATE`,
      [req.params.requestId,req.auth!.organisationId]
    );
    if(!approval.rowCount){await client.query('ROLLBACK');return res.status(404).json({error:{code:'APPROVAL_REQUEST_NOT_FOUND'}});}
    if(approval.rows[0].requested_by===req.auth!.userId){
      await client.query('ROLLBACK');
      return res.status(409).json({error:{code:'SELF_APPROVAL_FORBIDDEN',message:'A different manager must decide this request'}});
    }
    if(approval.rows[0].status!=='PENDING'){
      await client.query('ROLLBACK');
      return res.status(409).json({error:{code:'APPROVAL_REQUEST_NOT_PENDING'}});
    }
    const ticket=await client.query(
      'SELECT * FROM bar_tickets WHERE id=$1 AND organisation_id=$2 FOR UPDATE',
      [approval.rows[0].ticket_id,req.auth!.organisationId]
    );
    if(!ticket.rowCount){await client.query('ROLLBACK');return res.status(404).json({error:{code:'TICKET_NOT_FOUND'}});}
    const body=approval.rows[0].request_payload as {amount?:number;reason:string};
    let status:'APPROVED'|'REJECTED'=parsed.data.decision==='APPROVE'?'APPROVED':'REJECTED';
    if(status==='APPROVED'&&['DISCOUNT','COMP'].includes(approval.rows[0].request_type)){
      if(ticket.rows[0].status!=='SENT'){
        await client.query('ROLLBACK');
        return res.status(409).json({error:{code:'TICKET_NOT_ADJUSTABLE'}});
      }
      const [payments,refunds]=await Promise.all([
        client.query('SELECT 1 FROM bar_payments WHERE ticket_id=$1 LIMIT 1',[ticket.rows[0].id]),
        client.query('SELECT 1 FROM bar_refunds WHERE ticket_id=$1 LIMIT 1',[ticket.rows[0].id])
      ]);
      if(payments.rowCount||refunds.rowCount||Number(body.amount)>Number(ticket.rows[0].grand_total)+0.001){
        await client.query('ROLLBACK');
        return res.status(409).json({error:{code:'TICKET_ADJUSTMENT_NO_LONGER_VALID'}});
      }
      await client.query(
        `INSERT INTO bar_ticket_adjustments(
           organisation_id,outlet_id,ticket_id,approval_request_id,adjustment_type,amount,reason,created_by
         ) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
        [approval.rows[0].organisation_id,approval.rows[0].outlet_id,ticket.rows[0].id,
          approval.rows[0].id,approval.rows[0].request_type,body.amount,body.reason,approval.rows[0].requested_by]
      );
      await client.query(
        `UPDATE bar_tickets SET discount_total=discount_total+$1,grand_total=grand_total-$1
         WHERE id=$2 AND organisation_id=$3`,
        [body.amount,ticket.rows[0].id,req.auth!.organisationId]
      );
      status='APPROVED';
    }
    const updated=await client.query(
      `UPDATE bar_ticket_approval_requests SET status=$1,decided_by=$2,decision_reason=$3,decided_at=NOW()
       WHERE id=$4 AND organisation_id=$5 RETURNING *`,
      [status,req.auth!.userId,parsed.data.reason,req.params.requestId,req.auth!.organisationId]
    );
    await client.query(
      `INSERT INTO audit_events(organisation_id,outlet_id,actor_user_id,event_type,entity_type,entity_id,reason,metadata)
       VALUES($1,$2,$3,$4,'BAR_TICKET',$5,$6,$7)`,
      [approval.rows[0].organisation_id,approval.rows[0].outlet_id,req.auth!.userId,
        status==='APPROVED'?'BAR_TICKET_APPROVAL_GRANTED':'BAR_TICKET_APPROVAL_REJECTED',
        ticket.rows[0].id,parsed.data.reason,{approvalRequestId:approval.rows[0].id,type:approval.rows[0].request_type}]
    );
    await client.query('COMMIT');
    return res.json({data:updated.rows[0]});
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
});

barCheckoutRouter.post('/bar/tickets/:ticketId/void', requirePermission('bar:refund'), async (req,res) => {
  const parsed=z.object({
    approvalRequestId:uuid,
    idempotencyKey:z.string().trim().min(16).max(160),
  }).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:parsed.error.flatten()}});
  const org=req.auth!.organisationId!;
  const fingerprint=createHash('sha256').update(JSON.stringify([
    String(req.params.ticketId).toLowerCase(),parsed.data.approvalRequestId.toLowerCase(),parsed.data.idempotencyKey
  ])).digest('hex');
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const ticket=await client.query(
      'SELECT * FROM bar_tickets WHERE id=$1 AND organisation_id=$2 FOR UPDATE',
      [req.params.ticketId,org]
    );
    if(!ticket.rowCount){await client.query('ROLLBACK');return res.status(404).json({error:{code:'TICKET_NOT_FOUND'}});}
    const prior=await client.query(
      `SELECT request_fingerprint FROM bar_ticket_void_requests
       WHERE organisation_id=$1 AND ticket_id=$2 AND idempotency_key=$3 FOR UPDATE`,
      [org,req.params.ticketId,parsed.data.idempotencyKey]
    );
    if(prior.rowCount){
      if(prior.rows[0].request_fingerprint!==fingerprint){
        await client.query('ROLLBACK');
        return res.status(409).json({error:{code:'IDEMPOTENCY_KEY_REUSED'}});
      }
      await client.query('COMMIT');
      return res.json({data:ticket.rows[0],idempotentReplay:true});
    }
    const approval=await client.query(
      `SELECT * FROM bar_ticket_approval_requests
       WHERE id=$1 AND ticket_id=$2 AND organisation_id=$3 AND request_type='VOID' AND status='APPROVED'
       FOR UPDATE`,
      [parsed.data.approvalRequestId,req.params.ticketId,org]
    );
    if(!approval.rowCount||approval.rows[0].requested_by===approval.rows[0].decided_by){
      await client.query('ROLLBACK');
      return res.status(409).json({error:{code:'VOID_APPROVAL_REQUIRED',message:'A different manager must approve this ticket void before it can be executed'}});
    }
    const voidReason=(approval.rows[0].request_payload as {reason:string}).reason;
    const access=await checkOutletOperationalAccess(client,org,ticket.rows[0].outlet_id,'BAR_SERVICE',{
      userId:req.auth!.userId,roleCode:req.auth!.roleCode
    });
    if(!access.allowed){
      await client.query('ROLLBACK');
      return res.status(403).json({error:{code:access.code,message:access.message}});
    }
    if(ticket.rows[0].status!=='SENT'){
      await client.query('ROLLBACK');
      return res.status(409).json({error:{code:'TICKET_NOT_VOIDABLE',message:'Only unpaid, unvoided bar tickets can be voided'}});
    }
    const [payments,refunds,kots,lines]=await Promise.all([
      client.query('SELECT 1 FROM bar_payments WHERE ticket_id=$1 LIMIT 1',[req.params.ticketId]),
      client.query('SELECT 1 FROM bar_refunds WHERE ticket_id=$1 LIMIT 1',[req.params.ticketId]),
      client.query('SELECT id,status FROM bar_kot_orders WHERE ticket_id=$1 FOR UPDATE',[req.params.ticketId]),
      client.query("SELECT id,product_id,line_type,quantity,volume_ml,open_bottle_id,stock_movement_id FROM bar_ticket_lines WHERE ticket_id=$1 AND quantity>0 FOR UPDATE",[req.params.ticketId])
    ]);
    if(payments.rowCount||refunds.rowCount){
      await client.query('ROLLBACK');
      return res.status(409).json({error:{code:'TICKET_HAS_FINANCIAL_ACTIVITY',message:'Tickets with payments or refunds must use the refund workflow'}});
    }
    if(!kots.rowCount||kots.rows.some((kot:any)=>['SERVED','CANCELLED'].includes(kot.status))){
      await client.query('ROLLBACK');
      return res.status(409).json({error:{code:'KOT_NOT_VOIDABLE',message:'Tickets with served or already-cancelled preparation tickets cannot be voided'}});
    }
    const preparationStarted=kots.rows.some((kot:any)=>kot.status!=='NEW');
    if(!lines.rowCount||(!preparationStarted&&lines.rows.some((line:any)=>line.line_type==='PEG'))){
      await client.query('ROLLBACK');
      return res.status(409).json({error:{code:'PEG_VOID_REQUIRES_REFUND',message:'Peg pours cannot be restored to saleable bottle stock; use the authorised refund and quarantine workflow'}});
    }
    const inventoryDisposition=preparationStarted?'WASTAGE':'RESTOCKED';
    const voidRequest=await client.query(
      `INSERT INTO bar_ticket_void_requests(
         organisation_id,outlet_id,ticket_id,idempotency_key,request_fingerprint,reason,created_by,
         inventory_disposition,approval_request_id
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [org,ticket.rows[0].outlet_id,req.params.ticketId,parsed.data.idempotencyKey,
        fingerprint,voidReason,req.auth!.userId,inventoryDisposition,approval.rows[0].id]
    );
    const legacySales=await client.query(
      `SELECT id,product_id,quantity_units FROM stock_movements
       WHERE organisation_id=$1 AND outlet_id=$2 AND reference_type='BAR_TICKET'
         AND reference_id=$3 AND movement_type='SALE' ORDER BY created_at,id FOR UPDATE`,
      [org,ticket.rows[0].outlet_id,req.params.ticketId]
    );
    const assignedLegacyMovementIds=new Set<string>();
    for(const line of lines.rows){
      let modifierVoidCost=0;
      if(preparationStarted&&line.line_type==='PEG'){
        const pegEvidence=await client.query(
          `SELECT COALESCE(SUM(volume_ml),0)::numeric volume_ml
             FROM peg_transactions
            WHERE organisation_id=$1 AND outlet_id=$2 AND reference_id=$3
              AND open_bottle_id=$4 AND transaction_type='SALE'`,
          [org,ticket.rows[0].outlet_id,req.params.ticketId,line.open_bottle_id]
        );
        const wastedVolume=Number(line.volume_ml)*Number(line.quantity);
        if(Number(pegEvidence.rows[0].volume_ml)+0.0005<wastedVolume){
          await client.query('ROLLBACK');
          return res.status(409).json({error:{code:'PEG_WASTAGE_EVIDENCE_MISSING',message:'Cannot void because the original pour consumption evidence is unavailable'}});
        }
        await client.query(
          `INSERT INTO bar_ticket_void_disposition_lines(
             organisation_id,outlet_id,void_request_id,ticket_line_id,product_id,line_type,quantity,
             volume_ml,disposition,cost_amount,created_by
           ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'WASTAGE',0,$9)`,
          [org,ticket.rows[0].outlet_id,voidRequest.rows[0].id,line.id,line.product_id,
            line.line_type,line.quantity,wastedVolume,req.auth!.userId]
        );
        continue;
      }
      if(line.stock_movement_id===null){
        const recipeConsumptions=await client.query(
          `SELECT c.ingredient_product_id,c.quantity_units,c.stock_movement_id,
                  m.quantity_units AS movement_quantity,e.covered_units,e.extended_cost
             FROM bar_ticket_recipe_consumptions c
             JOIN stock_movements m ON m.id=c.stock_movement_id
              AND m.organisation_id=c.organisation_id AND m.outlet_id=c.outlet_id
              AND m.product_id=c.ingredient_product_id AND m.movement_type='SALE'
             LEFT JOIN inventory_cost_consumption_events e
               ON e.source_id=m.id AND e.organisation_id=c.organisation_id
              AND e.source_type='BAR_RECIPE_INGREDIENT'
            WHERE c.organisation_id=$1 AND c.outlet_id=$2 AND c.ticket_line_id=$3
            ORDER BY c.ingredient_product_id,c.id FOR UPDATE OF c,m`,
          [org,ticket.rows[0].outlet_id,line.id]
        );
        const modifierConsumptions=await client.query(
          `SELECT c.ingredient_product_id,c.quantity_units,c.stock_movement_id,
                  m.quantity_units AS movement_quantity,e.covered_units,e.extended_cost
             FROM bar_ticket_modifier_consumptions c
             JOIN bar_ticket_line_modifiers modifier ON modifier.id=c.modifier_id
             JOIN stock_movements m ON m.id=c.stock_movement_id
              AND m.organisation_id=c.organisation_id AND m.outlet_id=$2
              AND m.product_id=c.ingredient_product_id AND m.movement_type='SALE'
             LEFT JOIN inventory_cost_consumption_events e
               ON e.source_id=m.id AND e.organisation_id=c.organisation_id
              AND e.source_type='BAR_MODIFIER'
            WHERE c.organisation_id=$1 AND modifier.ticket_line_id=$3
            ORDER BY c.ingredient_product_id,c.id FOR UPDATE OF c,m`,
          [org,ticket.rows[0].outlet_id,line.id]
        );
        const ingredientConsumptions=[
          ...recipeConsumptions.rows,
          ...modifierConsumptions.rows
        ];
        if(ingredientConsumptions.length){
          let totalCost=0;
          for(const ingredient of ingredientConsumptions){
            const quantity=Number(ingredient.quantity_units);
            if(Math.abs(Number(ingredient.movement_quantity)-quantity)>0.0005){
              await client.query('ROLLBACK');
              return res.status(409).json({error:{code:'RECIPE_STOCK_EVIDENCE_MISMATCH',message:'Recipe ingredient consumption does not reconcile with its stock movement'}});
            }
            const covered=Number(ingredient.covered_units??0);
            const cost=Number(ingredient.extended_cost??0);
            totalCost+=cost;
            if(preparationStarted)continue;
            const restored=await client.query(
              `UPDATE stock_balances SET quantity_units=quantity_units+$1,updated_at=NOW()
                WHERE organisation_id=$2 AND outlet_id=$3 AND product_id=$4`,
              [quantity,org,ticket.rows[0].outlet_id,ingredient.ingredient_product_id]
            );
            if(!restored.rowCount)throw new Error('RECIPE_STOCK_BALANCE_MISSING_FOR_VOID');
            const returned=await appendStockMovementOnce(client,{
              organisationId:org,outletId:ticket.rows[0].outlet_id,productId:ingredient.ingredient_product_id,
              movementType:'RETURN',quantityUnits:quantity,referenceType:'BAR_TICKET_VOID_RECIPE',
              referenceId:String(req.params.ticketId),
              idempotencyKey:`bar-ticket-void:${req.params.ticketId}:${line.id}:ingredient:${ingredient.stock_movement_id}`,
              notes:voidReason,createdBy:req.auth!.userId
            });
            if(!returned.created)throw new Error('RECIPE_STOCK_VOID_MOVEMENT_EXISTS_BEFORE_VOID_COMMIT');
            await restoreInventoryBatchFefo(client,{
              organisationId:org,outletId:ticket.rows[0].outlet_id,
              productId:ingredient.ingredient_product_id,sourceMovementIds:[ingredient.stock_movement_id],
              returnMovementId:returned.id,quantityUnits:quantity
            });
            if(covered>0)await addInventoryCostLayer(client,{
              organisationId:org,outletId:ticket.rows[0].outlet_id,productId:ingredient.ingredient_product_id,
              sourceType:'RETURN',sourceId:returned.id,sourceLineId:randomUUID(),
              quantityUnits:covered,unitCost:cost/covered
            });
          }
          await client.query(
            `INSERT INTO bar_ticket_void_disposition_lines(
               organisation_id,outlet_id,void_request_id,ticket_line_id,product_id,line_type,quantity,
               disposition,cost_amount,created_by
             ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [org,ticket.rows[0].outlet_id,voidRequest.rows[0].id,line.id,line.product_id,
              line.line_type,line.quantity,preparationStarted?'WASTAGE':'RESTOCKED',
              Math.round(totalCost*100)/100,req.auth!.userId]
          );
          continue;
        }
      }
      if(line.stock_movement_id!==null){
        const modifierConsumptions=await client.query(
          `SELECT c.ingredient_product_id,c.quantity_units,c.stock_movement_id,
                  m.quantity_units AS movement_quantity,e.covered_units,e.extended_cost
             FROM bar_ticket_modifier_consumptions c
             JOIN bar_ticket_line_modifiers modifier ON modifier.id=c.modifier_id
             JOIN stock_movements m ON m.id=c.stock_movement_id
              AND m.organisation_id=c.organisation_id AND m.outlet_id=$2
              AND m.product_id=c.ingredient_product_id AND m.movement_type='SALE'
             LEFT JOIN inventory_cost_consumption_events e
               ON e.source_id=m.id AND e.organisation_id=c.organisation_id
              AND e.source_type='BAR_MODIFIER'
            WHERE c.organisation_id=$1 AND modifier.ticket_line_id=$3
            ORDER BY c.ingredient_product_id,c.id FOR UPDATE OF c,m`,
          [org,ticket.rows[0].outlet_id,line.id]
        );
        for(const ingredient of modifierConsumptions.rows){
          const quantity=Number(ingredient.quantity_units);
          if(Math.abs(Number(ingredient.movement_quantity)-quantity)>0.0005){
            await client.query('ROLLBACK');
            return res.status(409).json({error:{code:'MODIFIER_STOCK_EVIDENCE_MISMATCH',message:'Modifier ingredient consumption does not reconcile with its stock movement'}});
          }
          const covered=Number(ingredient.covered_units??0);
          const cost=Number(ingredient.extended_cost??0);
          modifierVoidCost+=cost;
          if(preparationStarted)continue;
          const restored=await client.query(
            `UPDATE stock_balances SET quantity_units=quantity_units+$1,updated_at=NOW()
              WHERE organisation_id=$2 AND outlet_id=$3 AND product_id=$4`,
            [quantity,org,ticket.rows[0].outlet_id,ingredient.ingredient_product_id]
          );
          if(!restored.rowCount)throw new Error('MODIFIER_STOCK_BALANCE_MISSING_FOR_VOID');
          const returned=await appendStockMovementOnce(client,{
            organisationId:org,outletId:ticket.rows[0].outlet_id,productId:ingredient.ingredient_product_id,
            movementType:'RETURN',quantityUnits:quantity,referenceType:'BAR_TICKET_VOID_MODIFIER',
            referenceId:String(req.params.ticketId),
            idempotencyKey:`bar-ticket-void:${req.params.ticketId}:${line.id}:modifier:${ingredient.stock_movement_id}`,
            notes:voidReason,createdBy:req.auth!.userId
          });
          if(!returned.created)throw new Error('MODIFIER_VOID_MOVEMENT_EXISTS_BEFORE_VOID_COMMIT');
          await restoreInventoryBatchFefo(client,{
            organisationId:org,outletId:ticket.rows[0].outlet_id,
            productId:ingredient.ingredient_product_id,sourceMovementIds:[ingredient.stock_movement_id],
            returnMovementId:returned.id,quantityUnits:quantity
          });
          if(covered>0)await addInventoryCostLayer(client,{
            organisationId:org,outletId:ticket.rows[0].outlet_id,productId:ingredient.ingredient_product_id,
            sourceType:'RETURN',sourceId:returned.id,sourceLineId:randomUUID(),
            quantityUnits:covered,unitCost:cost/covered
          });
        }
      }
      const adjustments=await client.query(
        `SELECT movement_id,direction,quantity_units FROM bar_ticket_line_stock_adjustments
         WHERE ticket_line_id=$1 ORDER BY created_at,id FOR UPDATE`,
        [line.id]
      );
      const original=await client.query(
        `SELECT id,quantity_units FROM stock_movements
         WHERE id=$1 AND organisation_id=$2 AND outlet_id=$3 AND movement_type='SALE' FOR UPDATE`,
        [line.stock_movement_id,org,ticket.rows[0].outlet_id]
      );
      let originalMovement=original.rows[0]??null;
      if(!originalMovement&&line.stock_movement_id===null){
        const legacy=legacySales.rows.find((row:any)=>!assignedLegacyMovementIds.has(row.id)
          &&row.product_id===line.product_id
          &&Math.abs(Number(row.quantity_units)-Number(line.quantity))<0.0005);
        if(legacy){
          originalMovement=legacy;
          assignedLegacyMovementIds.add(legacy.id);
        }
      }
      if(!originalMovement){
        await client.query('ROLLBACK');
        return res.status(409).json({error:{code:'STOCK_REVERSAL_EVIDENCE_MISSING',message:'Cannot void because the original stock movement is unavailable'}});
      }
      const soldQuantity=Number(originalMovement.quantity_units)+adjustments.rows
        .filter((row:any)=>row.direction==='SALE').reduce((sum:number,row:any)=>sum+Number(row.quantity_units),0);
      const returnedQuantity=adjustments.rows
        .filter((row:any)=>row.direction==='RETURN').reduce((sum:number,row:any)=>sum+Number(row.quantity_units),0);
      if(Math.abs(soldQuantity-returnedQuantity-Number(line.quantity))>0.0005){
        await client.query('ROLLBACK');
        return res.status(409).json({error:{code:'STOCK_REVERSAL_EVIDENCE_MISSING',message:'Cannot void because line quantity and stock adjustment evidence do not reconcile'}});
      }
      const saleMovementIds=[originalMovement.id,...adjustments.rows
        .filter((row:any)=>row.direction==='SALE').map((row:any)=>row.movement_id)];
      const returnMovementIds=adjustments.rows
        .filter((row:any)=>row.direction==='RETURN').map((row:any)=>row.movement_id);
      const [costs,returnedCosts]=await Promise.all([
        client.query(
          `SELECT COALESCE(SUM(quantity_units),0) quantity,COALESCE(SUM(extended_cost),0) cost
             FROM inventory_cost_consumptions WHERE movement_id=ANY($1::uuid[])`,
          [saleMovementIds]
        ),
        client.query(
          `SELECT COALESCE(SUM(received_units),0) quantity,
                  COALESCE(SUM(received_units*unit_cost),0) cost
             FROM inventory_cost_layers
            WHERE source_type='RETURN' AND source_id=ANY($1::uuid[])`,
          [returnMovementIds]
        )
      ]);
      const netCostQuantity=Number(costs.rows[0].quantity)-Number(returnedCosts.rows[0].quantity);
      const netCostAmount=Number(costs.rows[0].cost)-Number(returnedCosts.rows[0].cost);
      const dispositionCost=netCostAmount+modifierVoidCost;
      if(Math.abs(netCostQuantity-Number(line.quantity))>0.0005||netCostAmount<0){
        await client.query('ROLLBACK');
        return res.status(409).json({error:{code:'COST_REVERSAL_EVIDENCE_MISSING',message:'Cannot void because FIFO cost evidence does not reconcile with the remaining line quantity'}});
      }
      if(preparationStarted){
        await client.query(
          `INSERT INTO bar_ticket_void_disposition_lines(
             organisation_id,outlet_id,void_request_id,ticket_line_id,product_id,line_type,quantity,
             disposition,stock_movement_id,cost_amount,created_by
           ) VALUES($1,$2,$3,$4,$5,$6,$7,'WASTAGE',$8,$9,$10)`,
          [org,ticket.rows[0].outlet_id,voidRequest.rows[0].id,line.id,line.product_id,
            line.line_type,line.quantity,originalMovement.id,Math.round(dispositionCost*100)/100,req.auth!.userId]
        );
        continue;
      }
      const restored=await client.query(
        `UPDATE stock_balances SET quantity_units=quantity_units+$1,updated_at=NOW()
         WHERE organisation_id=$2 AND outlet_id=$3 AND product_id=$4`,
        [line.quantity,org,ticket.rows[0].outlet_id,line.product_id]
      );
      if(!restored.rowCount)throw new Error('STOCK_BALANCE_MISSING_FOR_VOID');
      const returned=await appendStockMovementOnce(client,{
        organisationId:org,outletId:ticket.rows[0].outlet_id,productId:line.product_id,
        movementType:'RETURN',quantityUnits:Number(line.quantity),
        referenceType:'BAR_TICKET_VOID',referenceId:String(req.params.ticketId),
        idempotencyKey:`bar-ticket-void:${req.params.ticketId}:${line.id}`,
        notes:voidReason,createdBy:req.auth!.userId
      });
      if(!returned.created)throw new Error('STOCK_VOID_MOVEMENT_EXISTS_BEFORE_VOID_COMMIT');
      await restoreInventoryBatchFefo(client,{
        organisationId:org,outletId:ticket.rows[0].outlet_id,productId:line.product_id,
        sourceMovementIds:saleMovementIds,returnMovementId:returned.id,quantityUnits:Number(line.quantity)
      });
      await addInventoryCostLayer(client,{
        organisationId:org,outletId:ticket.rows[0].outlet_id,productId:line.product_id,
        sourceType:'RETURN',sourceId:returned.id,sourceLineId:randomUUID(),
        quantityUnits:Number(line.quantity),unitCost:netCostAmount/Number(line.quantity)
      });
      await client.query(
        `INSERT INTO bar_ticket_void_disposition_lines(
           organisation_id,outlet_id,void_request_id,ticket_line_id,product_id,line_type,quantity,
           disposition,stock_movement_id,cost_amount,created_by
         ) VALUES($1,$2,$3,$4,$5,$6,$7,'RESTOCKED',$8,$9,$10)`,
        [org,ticket.rows[0].outlet_id,voidRequest.rows[0].id,line.id,line.product_id,
          line.line_type,line.quantity,originalMovement.id,Math.round(dispositionCost*100)/100,req.auth!.userId]
      );
    }
    await client.query(
      `UPDATE bar_kot_orders SET status='CANCELLED',cancelled_by=$1,updated_at=NOW()
       WHERE ticket_id=$2`,
      [req.auth!.userId,req.params.ticketId]
    );
    const voided=await client.query(
      `UPDATE bar_tickets SET status='VOIDED',closed_at=NOW()
       WHERE id=$1 AND organisation_id=$2 RETURNING *`,
      [req.params.ticketId,org]
    );
    await client.query(
      `INSERT INTO audit_events(organisation_id,outlet_id,actor_user_id,event_type,entity_type,entity_id,reason,metadata)
       VALUES($1,$2,$3,'BAR_TICKET_VOIDED','BAR_TICKET',$4,$5,$6)`,
      [org,ticket.rows[0].outlet_id,req.auth!.userId,req.params.ticketId,voidReason,
        {inventoryDisposition,reversedStockMovements:inventoryDisposition==='RESTOCKED'?lines.rowCount:0,lineCount:lines.rowCount}]
    );
    await client.query(
      `UPDATE bar_ticket_approval_requests SET status='EXECUTED',executed_at=NOW()
       WHERE id=$1 AND organisation_id=$2`,
      [approval.rows[0].id,org]
    );
    await client.query('COMMIT');
    return res.status(200).json({data:{...voided.rows[0],inventoryDisposition},idempotentReplay:false});
  }catch(error:any){
    await client.query('ROLLBACK');
    if(typeof error?.code==='string'&&error.code.startsWith('INVENTORY_BATCH_'))return res.status(409).json({error:{code:error.code,message:error.message}});
    throw error;
  }finally{client.release();}
});

// P517: open table sessions are the authoritative table identity for bar service.
barCheckoutRouter.get('/bar/table-sessions', requirePermission('bar:read'), async (req,res) => {
  const outletId=typeof req.query.outletId==='string'?req.query.outletId:null;
  if(!outletId||!uuid.safeParse(outletId).success)return res.status(400).json({error:{code:'INVALID_OUTLET_ID'}});
  const includeHeld=req.query.includeHeld==='true';
  const result=await pool.query(
    `SELECT s.*,
       (SELECT COUNT(*)::int FROM bar_tickets t WHERE t.table_session_id=s.id) ticket_count,
       COALESCE((SELECT SUM(t.grand_total) FROM bar_tickets t WHERE t.table_session_id=s.id AND t.status<>'VOIDED'),0) billed_total,
       COALESCE((SELECT SUM(p.amount) FROM bar_payments p JOIN bar_tickets t ON t.id=p.ticket_id WHERE t.table_session_id=s.id),0) paid_total,
       COALESCE((SELECT SUM(GREATEST(t.grand_total-COALESCE(pay.paid_total,0),0))
         FROM bar_tickets t LEFT JOIN LATERAL (SELECT SUM(p.amount) paid_total FROM bar_payments p WHERE p.ticket_id=t.id) pay ON true
         WHERE t.table_session_id=s.id AND t.status NOT IN ('PAID','VOIDED')),0) outstanding_total,
       COALESCE((SELECT json_agg(json_build_object(
         'id',t.id,'ticket_number',t.ticket_number,'status',t.status,'grand_total',t.grand_total,
         'paid_total',COALESCE(pay.paid_total,0),
         'balance_due',GREATEST(t.grand_total-COALESCE(pay.paid_total,0),0)
       ) ORDER BY t.opened_at)
         FROM bar_tickets t LEFT JOIN LATERAL (SELECT SUM(p.amount) paid_total FROM bar_payments p WHERE p.ticket_id=t.id) pay ON true
         WHERE t.table_session_id=s.id AND t.status<>'VOIDED'),'[]'::json) tickets,
       (SELECT COUNT(*)::int FROM bar_kot_orders k WHERE k.table_session_id=s.id AND k.status NOT IN ('SERVED','CANCELLED')) pending_kot_count
     FROM bar_table_sessions s WHERE s.organisation_id=$1 AND s.outlet_id=$2
       AND (s.status='OPEN' OR ($3::boolean AND s.status='HELD')) ORDER BY s.opened_at`,
    [req.auth!.organisationId!,outletId,includeHeld]
  );
  return res.json({data:result.rows});
});

barCheckoutRouter.post('/bar/table-sessions', requirePermission('bar:sell'), async(req,res) => {
  const schema=z.object({outletId:uuid,tableLabel:z.string().trim().min(1).max(40),covers:z.number().int().min(1).max(100).default(1)});
  const parsed=schema.safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:parsed.error.flatten()}});
  const d=parsed.data,org=req.auth!.organisationId!;
  const access=await pool.query("SELECT id FROM outlets WHERE id=$1 AND organisation_id=$2 AND status='ACTIVE'",[d.outletId,org]);
  if(!access.rowCount)return res.status(404).json({error:{code:'OUTLET_NOT_FOUND'}});
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const outletAccess=await checkOutletOperationalAccess(client,org,d.outletId,'BAR_SERVICE',{userId:req.auth!.userId,roleCode:req.auth!.roleCode});
    if(!outletAccess.allowed){await client.query('ROLLBACK');return res.status(403).json({error:{code:outletAccess.code,message:outletAccess.message}});}
    const created=await client.query(
      `INSERT INTO bar_table_sessions(organisation_id,outlet_id,table_label,covers,opened_by)
       VALUES($1,$2,$3,$4,$5) RETURNING *`,
      [org,d.outletId,d.tableLabel,d.covers,req.auth!.userId]
    );
    await client.query(`INSERT INTO audit_events(organisation_id,outlet_id,actor_user_id,event_type,entity_type,entity_id,metadata)
      VALUES($1,$2,$3,'BAR_TABLE_SESSION_OPENED','BAR_TABLE_SESSION',$4,$5)`,
      [org,d.outletId,req.auth!.userId,created.rows[0].id,{tableLabel:d.tableLabel,covers:d.covers}]);
    await client.query('COMMIT');
    return res.status(201).json({data:created.rows[0]});
  }catch(error:any){
    await client.query('ROLLBACK');
    if(error?.code==='23505')return res.status(409).json({error:{code:'TABLE_ALREADY_OPEN',message:'An open session already exists for this table'}});
    throw error;
  }finally{client.release();}
});

barCheckoutRouter.post('/bar/table-sessions/:sessionId/status', requirePermission('bar:sell'), async(req,res) => {
  const parsed=z.object({
    status:z.enum(['OPEN','HELD']),
    reason:z.string().trim().min(3).max(500)
  }).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:parsed.error.flatten()}});
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const current=await client.query(
      `SELECT * FROM bar_table_sessions
        WHERE id=$1 AND organisation_id=$2 AND status IN ('OPEN','HELD')
        FOR UPDATE`,
      [req.params.sessionId,req.auth!.organisationId]
    );
    if(!current.rowCount){
      await client.query('ROLLBACK');
      return res.status(404).json({error:{code:'ACTIVE_SESSION_NOT_FOUND'}});
    }
    if(current.rows[0].status===parsed.data.status){
      await client.query('COMMIT');
      return res.json({data:current.rows[0],unchanged:true});
    }
    const held=parsed.data.status==='HELD';
    const updated=await client.query(
      `UPDATE bar_table_sessions SET status=$1,
         held_at=CASE WHEN $1='HELD' THEN NOW() ELSE held_at END,
         held_by=CASE WHEN $1='HELD' THEN $2 ELSE held_by END,
         reopened_at=CASE WHEN $1='OPEN' THEN NOW() ELSE reopened_at END,
         reopened_by=CASE WHEN $1='OPEN' THEN $2 ELSE reopened_by END,
         updated_at=NOW()
       WHERE id=$3 RETURNING *`,
      [parsed.data.status,req.auth!.userId,req.params.sessionId]
    );
    await client.query(
      `INSERT INTO audit_events(organisation_id,outlet_id,actor_user_id,event_type,entity_type,entity_id,reason,metadata)
       VALUES($1,$2,$3,$4,'BAR_TABLE_SESSION',$5,$6,$7)`,
      [req.auth!.organisationId,current.rows[0].outlet_id,req.auth!.userId,
        held?'BAR_TABLE_SESSION_HELD':'BAR_TABLE_SESSION_REOPENED',
        req.params.sessionId,parsed.data.reason,
        {from:current.rows[0].status,to:parsed.data.status,tableLabel:current.rows[0].table_label}]
    );
    await client.query('COMMIT');
    return res.json({data:updated.rows[0]});
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
});

barCheckoutRouter.post('/bar/table-sessions/:sessionId/transfer', requirePermission('bar:sell'), async(req,res) => {
  const parsed=z.object({tableLabel:z.string().trim().min(1).max(40),reason:z.string().trim().min(3).max(500)}).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:parsed.error.flatten()}});
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const current=await client.query("SELECT * FROM bar_table_sessions WHERE id=$1 AND organisation_id=$2 AND status='OPEN' FOR UPDATE",[req.params.sessionId,req.auth!.organisationId]);
    if(!current.rowCount){await client.query('ROLLBACK');return res.status(404).json({error:{code:'OPEN_SESSION_NOT_FOUND'}});}
    const updated=await client.query("UPDATE bar_table_sessions SET table_label=$1,updated_at=NOW() WHERE id=$2 RETURNING *",[parsed.data.tableLabel,req.params.sessionId]);
    await client.query("UPDATE bar_tickets SET table_label=$1 WHERE table_session_id=$2",[parsed.data.tableLabel,req.params.sessionId]);
    await client.query(`INSERT INTO audit_events(organisation_id,outlet_id,actor_user_id,event_type,entity_type,entity_id,reason,metadata)
      VALUES($1,$2,$3,'BAR_TABLE_TRANSFERRED','BAR_TABLE_SESSION',$4,$5,$6)`,
      [req.auth!.organisationId,current.rows[0].outlet_id,req.auth!.userId,req.params.sessionId,parsed.data.reason,{from:current.rows[0].table_label,to:parsed.data.tableLabel}]);
    await client.query('COMMIT');return res.json({data:updated.rows[0]});
  }catch(error:any){await client.query('ROLLBACK');if(error?.code==='23505')return res.status(409).json({error:{code:'TABLE_ALREADY_OPEN'}});throw error;}
  finally{client.release();}
});

barCheckoutRouter.post('/bar/table-sessions/:sessionId/merge', requirePermission('bar:sell'), async(req,res) => {
  const parsed=z.object({targetSessionId:uuid,reason:z.string().trim().min(3).max(500)}).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:parsed.error.flatten()}});
  if(parsed.data.targetSessionId===req.params.sessionId)return res.status(400).json({error:{code:'SAME_SESSION'}});
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const ids=[req.params.sessionId,parsed.data.targetSessionId].sort();
    const sessions=await client.query("SELECT * FROM bar_table_sessions WHERE id=ANY($1::uuid[]) AND organisation_id=$2 AND status='OPEN' ORDER BY id FOR UPDATE",[ids,req.auth!.organisationId]);
    if(sessions.rowCount!==2||sessions.rows[0].outlet_id!==sessions.rows[1].outlet_id){await client.query('ROLLBACK');return res.status(409).json({error:{code:'MERGE_SESSION_INVALID',message:'Both open sessions must belong to the same outlet'} });}
    const source=sessions.rows.find((s:any)=>s.id===req.params.sessionId);
    const target=sessions.rows.find((s:any)=>s.id===parsed.data.targetSessionId);
    if(Number(source.covers)+Number(target.covers)>100){await client.query('ROLLBACK');return res.status(409).json({error:{code:'TABLE_CAPACITY_LIMIT',message:'Merged guest count cannot exceed 100'}});}
    await client.query("UPDATE bar_tickets SET table_session_id=$1,table_label=$2 WHERE table_session_id=$3",[target.id,target.table_label,source.id]);
    await client.query("UPDATE bar_table_sessions SET covers=covers+$1,updated_at=NOW() WHERE id=$2",[source.covers,target.id]);
    await client.query("UPDATE bar_kot_orders SET table_session_id=$1,updated_at=NOW() WHERE table_session_id=$2",[target.id,source.id]);
    await client.query("UPDATE bar_table_sessions SET status='CLOSED',closed_by=$1,closed_at=NOW(),updated_at=NOW() WHERE id=$2",[req.auth!.userId,source.id]);
    await client.query(`INSERT INTO audit_events(organisation_id,outlet_id,actor_user_id,event_type,entity_type,entity_id,reason,metadata)
      VALUES($1,$2,$3,'BAR_TABLE_SESSIONS_MERGED','BAR_TABLE_SESSION',$4,$5,$6)`,
      [req.auth!.organisationId,target.outlet_id,req.auth!.userId,target.id,parsed.data.reason,{sourceSessionId:source.id,targetSessionId:target.id}]);
    await client.query('COMMIT');return res.json({data:{mergedSessionId:source.id,targetSessionId:target.id,tableLabel:target.table_label}});
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
});

barCheckoutRouter.post('/bar/table-sessions/:sessionId/close', requirePermission('bar:sell'), async(req,res) => {
  const parsed=z.object({reason:z.string().trim().min(3).max(500).optional()}).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:parsed.error.flatten()}});
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const session=await client.query("SELECT * FROM bar_table_sessions WHERE id=$1 AND organisation_id=$2 AND status IN ('OPEN','HELD') FOR UPDATE",[req.params.sessionId,req.auth!.organisationId]);
    if(!session.rowCount){await client.query('ROLLBACK');return res.status(404).json({error:{code:'OPEN_SESSION_NOT_FOUND'}});}
    const pending=await client.query("SELECT COUNT(*)::int count FROM bar_kot_orders WHERE table_session_id=$1 AND status NOT IN ('SERVED','CANCELLED')",[req.params.sessionId]);
    if(Number(pending.rows[0].count)>0){await client.query('ROLLBACK');return res.status(409).json({error:{code:'KOT_NOT_COMPLETE',message:'All preparation tickets must be served or cancelled before closing the table'} });}
    const due=await client.query(
      `SELECT COALESCE(SUM(GREATEST(t.grand_total-COALESCE(p.paid_total,0),0)),0) amount,
              COUNT(*) FILTER (WHERE t.status NOT IN ('PAID','VOIDED'))::int tickets
         FROM bar_tickets t LEFT JOIN LATERAL (SELECT SUM(amount) paid_total FROM bar_payments WHERE ticket_id=t.id) p ON true
        WHERE t.table_session_id=$1`,
      [req.params.sessionId]
    );
    if(Number(due.rows[0].tickets)>0||Number(due.rows[0].amount)>0.001){
      await client.query('ROLLBACK');
      return res.status(409).json({error:{code:'TAB_BALANCE_DUE',message:'All tickets must be fully settled before closing the table',remainingDue:Number(due.rows[0].amount)}});
    }
    const updated=await client.query("UPDATE bar_table_sessions SET status='CLOSED',closed_by=$1,closed_at=NOW(),updated_at=NOW() WHERE id=$2 RETURNING *",[req.auth!.userId,req.params.sessionId]);
    await client.query(`INSERT INTO audit_events(organisation_id,outlet_id,actor_user_id,event_type,entity_type,entity_id,reason,metadata)
      VALUES($1,$2,$3,'BAR_TABLE_SESSION_CLOSED','BAR_TABLE_SESSION',$4,$5,$6)`,
      [req.auth!.organisationId,session.rows[0].outlet_id,req.auth!.userId,req.params.sessionId,parsed.data.reason??'Table session closed',{tableLabel:session.rows[0].table_label}]);
    await client.query('COMMIT');return res.json({data:updated.rows[0]});
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
});

barCheckoutRouter.get('/bar/kot', requirePermission('bar:read'), async(req,res) => {
  const outletId=typeof req.query.outletId==='string'?req.query.outletId:null;
  if(!outletId||!uuid.safeParse(outletId).success)return res.status(400).json({error:{code:'INVALID_OUTLET_ID'}});
  const stationId=typeof req.query.stationId==='string'?req.query.stationId:null;
  if(stationId&&!uuid.safeParse(stationId).success)return res.status(400).json({error:{code:'INVALID_STATION_ID'}});
  const result=await pool.query(
    `SELECT k.*,t.ticket_number,t.table_label,s.table_label session_table_label,
       st.station_code,st.name station_name,
       COALESCE(json_agg(json_build_object('id',kl.id,'ticketLineId',kl.ticket_line_id,'productId',kl.product_id,'productName',p.name,'quantity',kl.quantity,'instructions',kl.instructions)) FILTER (WHERE kl.id IS NOT NULL),'[]'::json) lines
     FROM bar_kot_orders k JOIN bar_tickets t ON t.id=k.ticket_id
     LEFT JOIN bar_table_sessions s ON s.id=k.table_session_id
     LEFT JOIN bar_kot_stations st ON st.id=k.station_id
     LEFT JOIN bar_kot_lines kl ON kl.kot_order_id=k.id
     LEFT JOIN products p ON p.id=kl.product_id
     WHERE k.organisation_id=$1 AND k.outlet_id=$2 AND k.status<>'CANCELLED'
       AND ($3::uuid IS NULL OR k.station_id=$3)
     GROUP BY k.id,t.ticket_number,t.table_label,s.table_label,st.station_code,st.name ORDER BY k.created_at`,
    [req.auth!.organisationId!,outletId,stationId]
  );
  return res.json({data:result.rows});
});

barCheckoutRouter.get('/bar/kot/stations', requirePermission('bar:read'), async(req,res) => {
  const outletId=typeof req.query.outletId==='string'?req.query.outletId:null;
  if(!outletId||!uuid.safeParse(outletId).success)return res.status(400).json({error:{code:'INVALID_OUTLET_ID'}});
  const result=await pool.query(
    `SELECT id,station_code,name,is_default,status
       FROM bar_kot_stations
      WHERE organisation_id=$1 AND outlet_id=$2
      ORDER BY is_default DESC,name,id`,
    [req.auth!.organisationId!,outletId]
  );
  return res.json({data:result.rows});
});

barCheckoutRouter.post('/bar/kot/stations', requirePermission('bar:manage'), async(req,res) => {
  const parsed=z.object({
    outletId:uuid,
    stationCode:z.string().trim().min(1).max(30).transform(value=>value.toUpperCase()),
    name:z.string().trim().min(1).max(80),
    isDefault:z.boolean().default(false)
  }).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:parsed.error.flatten()}});
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const access=await checkOutletOperationalAccess(client,req.auth!.organisationId!,parsed.data.outletId,'BAR_SERVICE',{
      userId:req.auth!.userId,roleCode:req.auth!.roleCode
    });
    if(!access.allowed){await client.query('ROLLBACK');return res.status(403).json({error:{code:access.code,message:access.message}});}
    if(parsed.data.isDefault)await client.query(
      'UPDATE bar_kot_stations SET is_default=FALSE WHERE organisation_id=$1 AND outlet_id=$2 AND is_default',
      [req.auth!.organisationId!,parsed.data.outletId]
    );
    const result=await client.query(
      `INSERT INTO bar_kot_stations(organisation_id,outlet_id,station_code,name,is_default,created_by)
       VALUES($1,$2,$3,$4,$5,$6)
       RETURNING id,station_code,name,is_default,status`,
      [req.auth!.organisationId!,parsed.data.outletId,parsed.data.stationCode,parsed.data.name,parsed.data.isDefault,req.auth!.userId]
    );
    await client.query('COMMIT');
    return res.status(201).json({data:result.rows[0]});
  }catch(error){
    await client.query('ROLLBACK');
    if((error as {code?:string}).code==='23505')return res.status(409).json({error:{code:'KOT_STATION_CONFLICT',message:'A station with this code already exists, or the default station could not be changed'}});
    throw error;
  }finally{client.release();}
});

barCheckoutRouter.put('/bar/kot/stations/:stationId/products/:productId', requirePermission('bar:manage'), async(req,res) => {
  const params=z.object({stationId:uuid,productId:uuid}).safeParse(req.params);
  const body=z.object({outletId:uuid}).safeParse(req.body);
  if(!params.success||!body.success)return res.status(400).json({error:{code:'VALIDATION_ERROR'}});
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const access=await checkOutletOperationalAccess(client,req.auth!.organisationId!,body.data.outletId,'BAR_SERVICE',{
      userId:req.auth!.userId,roleCode:req.auth!.roleCode
    });
    if(!access.allowed){await client.query('ROLLBACK');return res.status(403).json({error:{code:access.code,message:access.message}});}
    const [station,product]=await Promise.all([
      client.query("SELECT id FROM bar_kot_stations WHERE id=$1 AND organisation_id=$2 AND outlet_id=$3 AND status='ACTIVE' FOR UPDATE",
        [params.data.stationId,req.auth!.organisationId!,body.data.outletId]),
      client.query("SELECT id FROM products WHERE id=$1 AND organisation_id=$2 AND status='ACTIVE'",
        [params.data.productId,req.auth!.organisationId!])
    ]);
    if(!station.rowCount||!product.rowCount){await client.query('ROLLBACK');return res.status(404).json({error:{code:!station.rowCount?'KOT_STATION_NOT_FOUND':'PRODUCT_NOT_FOUND'}});}
    await client.query(
      `INSERT INTO bar_kot_product_stations(organisation_id,outlet_id,product_id,station_id,assigned_by)
       VALUES($1,$2,$3,$4,$5)
       ON CONFLICT(organisation_id,outlet_id,product_id)
       DO UPDATE SET station_id=EXCLUDED.station_id,assigned_by=EXCLUDED.assigned_by,assigned_at=NOW()`,
      [req.auth!.organisationId!,body.data.outletId,params.data.productId,params.data.stationId,req.auth!.userId]
    );
    await client.query('COMMIT');
    return res.json({data:{productId:params.data.productId,stationId:params.data.stationId}});
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
});

barCheckoutRouter.post('/bar/kot/:kotId/status', requirePermission('bar:sell'), async(req,res) => {
  const parsed=z.object({status:z.enum(['ACCEPTED','PREPARING','READY','SERVED','CANCELLED']),reason:z.string().trim().min(3).max(500).optional()}).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:parsed.error.flatten()}});
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const kot=await client.query("SELECT * FROM bar_kot_orders WHERE id=$1 AND organisation_id=$2 FOR UPDATE",[req.params.kotId,req.auth!.organisationId]);
    if(!kot.rowCount){await client.query('ROLLBACK');return res.status(404).json({error:{code:'KOT_NOT_FOUND'}});}
    if(parsed.data.status==='CANCELLED'){
      await client.query('ROLLBACK');
      return res.status(409).json({error:{code:'USE_TICKET_VOID_WORKFLOW',message:'Cancel the unpaid ticket through the manager-authorised void workflow so stock and cost are reversed together'}});
    }
    const allowed:Record<string,string[]>={NEW:['ACCEPTED','CANCELLED'],ACCEPTED:['PREPARING','CANCELLED'],PREPARING:['READY','CANCELLED'],READY:['SERVED'],SERVED:[],CANCELLED:[]};
    if(!allowed[kot.rows[0].status]?.includes(parsed.data.status)){await client.query('ROLLBACK');return res.status(409).json({error:{code:'INVALID_KOT_TRANSITION',message:`Cannot change KOT from ${kot.rows[0].status} to ${parsed.data.status}`}});}
    const actorColumn:Record<string,string>={ACCEPTED:'accepted_by',PREPARING:'preparing_by',READY:'ready_by',SERVED:'served_by',CANCELLED:'cancelled_by'};
    const updated=await client.query(`UPDATE bar_kot_orders SET status=$1,${actorColumn[parsed.data.status]}=$2,updated_at=NOW() WHERE id=$3 AND organisation_id=$4 RETURNING *`,[parsed.data.status,req.auth!.userId,req.params.kotId,req.auth!.organisationId]);
    await client.query(`INSERT INTO audit_events(organisation_id,outlet_id,actor_user_id,event_type,entity_type,entity_id,reason,metadata)
      VALUES($1,$2,$3,'BAR_KOT_STATUS_CHANGED','BAR_KOT_ORDER',$4,$5,$6)`,
      [req.auth!.organisationId,kot.rows[0].outlet_id,req.auth!.userId,req.params.kotId,parsed.data.reason??`KOT moved to ${parsed.data.status}`,{from:kot.rows[0].status,to:parsed.data.status}]);
    await client.query('COMMIT');return res.json({data:updated.rows[0]});
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
});

barCheckoutRouter.post('/bar/kot/:kotId/reprints', requirePermission('bar:sell'), async(req,res) => {
  const parsed=z.object({reason:z.string().trim().min(3).max(500)}).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:parsed.error.flatten()}});
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const kot=await client.query(
      `SELECT k.*,t.ticket_number,t.table_label,s.table_label AS session_table_label,
              st.name AS station_name,st.station_code
       FROM bar_kot_orders k JOIN bar_tickets t ON t.id=k.ticket_id
       LEFT JOIN bar_table_sessions s ON s.id=k.table_session_id
       LEFT JOIN bar_kot_stations st ON st.id=k.station_id
       WHERE k.id=$1 AND k.organisation_id=$2 FOR UPDATE OF k`,
      [req.params.kotId,req.auth!.organisationId]
    );
    if(!kot.rowCount){await client.query('ROLLBACK');return res.status(404).json({error:{code:'KOT_NOT_FOUND'}});}
    const access=await checkOutletOperationalAccess(client,req.auth!.organisationId!,kot.rows[0].outlet_id,'BAR_SERVICE',{
      userId:req.auth!.userId,roleCode:req.auth!.roleCode
    });
    if(!access.allowed){
      await client.query('ROLLBACK');
      return res.status(403).json({error:{code:access.code,message:access.message}});
    }
    if(kot.rows[0].status==='CANCELLED'){
      await client.query('ROLLBACK');
      return res.status(409).json({error:{code:'KOT_CANCELLED'}});
    }
    const lines=await client.query(
      `SELECT p.name product_name,kl.quantity,kl.instructions
       FROM bar_kot_lines kl JOIN products p ON p.id=kl.product_id
       WHERE kl.kot_order_id=$1 ORDER BY kl.created_at,kl.id`,
      [req.params.kotId]
    );
    const reprint=await client.query(
      `INSERT INTO bar_kot_reprints(organisation_id,outlet_id,kot_id,printed_by,reason)
       VALUES($1,$2,$3,$4,$5) RETURNING id,created_at`,
      [req.auth!.organisationId,kot.rows[0].outlet_id,req.params.kotId,req.auth!.userId,parsed.data.reason]
    );
    await client.query(
      `INSERT INTO audit_events(organisation_id,outlet_id,actor_user_id,event_type,entity_type,entity_id,reason,metadata)
       VALUES($1,$2,$3,'BAR_KOT_REPRINTED','BAR_KOT_ORDER',$4,$5,$6)`,
      [req.auth!.organisationId,kot.rows[0].outlet_id,req.auth!.userId,req.params.kotId,
        parsed.data.reason,{reprintId:reprint.rows[0].id}]
    );
    await client.query('COMMIT');
    return res.status(201).json({data:{
      reprintId:reprint.rows[0].id,printedAt:reprint.rows[0].created_at,
      ticketNumber:kot.rows[0].ticket_number,tableLabel:kot.rows[0].session_table_label??kot.rows[0].table_label??'Walk-in',
      stationName:kot.rows[0].station_name??'Unassigned',stationCode:kot.rows[0].station_code??null,
      status:kot.rows[0].status,lines:lines.rows
    }});
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
});

barCheckoutRouter.post('/bar/checkout', requirePermission('bar:sell'), async (req, res) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() } });
  const data = parsed.data;
  const fingerprint = createBarCheckoutFingerprint(data);
  const organisationId = req.auth!.organisationId!;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const access = await checkOutletOperationalAccess(client, organisationId, data.outletId, 'BAR_SERVICE', { userId:req.auth!.userId, roleCode:req.auth!.roleCode });
    if (!access.allowed) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: { code: access.code, message: access.message } });
    }

    const replay = await client.query(
      'SELECT * FROM bar_tickets WHERE organisation_id=$1 AND outlet_id=$2 AND idempotency_key=$3 FOR UPDATE',
      [organisationId, data.outletId, data.idempotencyKey]
    );
    if (replay.rowCount) {
      const [payments,lines] = await Promise.all([
        client.query('SELECT method,amount,reference FROM bar_payments WHERE ticket_id=$1 ORDER BY created_at', [replay.rows[0].id]),
        client.query(
          `SELECT l.product_id,l.line_type,l.quantity,l.volume_ml,l.open_bottle_id,
             ARRAY(SELECT m.option_id FROM bar_ticket_line_modifiers m WHERE m.ticket_line_id=l.id ORDER BY m.option_id) modifier_option_ids
             FROM bar_ticket_lines l WHERE l.ticket_id=$1 ORDER BY l.id`,
          [replay.rows[0].id]
        )
      ]);
      const storedFingerprint=replay.rows[0].request_fingerprint?.trim()||createBarCheckoutFingerprint({
        outletId:data.outletId,ticketNumber:replay.rows[0].ticket_number,tableLabel:replay.rows[0].table_label??undefined,tableSessionId:replay.rows[0].table_session_id??undefined,
        lines:lines.rows.map((line:any)=>({productId:line.product_id,lineType:line.line_type,quantity:Number(line.quantity),volumeMl:line.volume_ml===null?undefined:Number(line.volume_ml),openBottleId:line.open_bottle_id??undefined,modifierOptionIds:line.modifier_option_ids??[]})),
        payments:payments.rows.map((p:any)=>({method:p.method,amount:Number(p.amount),reference:p.reference??undefined}))
      });
      if(storedFingerprint!==fingerprint){
        await client.query('ROLLBACK');
        return res.status(409).json({error:{code:'IDEMPOTENCY_KEY_REUSED',message:'This idempotency key was already used for a different bar checkout'}});
      }
      if(!replay.rows[0].request_fingerprint)await client.query('UPDATE bar_tickets SET request_fingerprint=$1 WHERE id=$2',[fingerprint,replay.rows[0].id]);
      await client.query('COMMIT');
      return res.json({ data: replay.rows[0], payments: payments.rows, lines:lines.rows, idempotentReplay: true });
    }

    const compliance = await evaluateExciseSale(client, { organisationId, outletId: data.outletId, channel: 'BAR', attestations: data.complianceAttestations, sourceType: 'ONLINE_BAR', sourceReference: data.idempotencyKey, actorUserId: req.auth!.userId });
    if (!compliance.allowed) {
      await client.query('COMMIT');
      return res.status(409).json({ error: { code: 'EXCISE_COMPLIANCE_BLOCKED', message: 'Bar sale blocked by current excise rules', reasons: compliance.reasonCodes, decisionId: compliance.decisionId } });
    }

    let tableSession:any=null;
    if(data.tableSessionId){
      const sessionResult=await client.query("SELECT * FROM bar_table_sessions WHERE id=$1 AND organisation_id=$2 AND outlet_id=$3 AND status='OPEN' FOR UPDATE",[data.tableSessionId,organisationId,data.outletId]);
      if(!sessionResult.rowCount){await client.query('ROLLBACK');return res.status(409).json({error:{code:'TABLE_SESSION_NOT_OPEN',message:'Selected table session is not open for this outlet'}});}
      tableSession=sessionResult.rows[0];
    }
    const resolvedTableLabel=tableSession?.table_label??data.tableLabel??null;

    const resolved: Array<{
      productId: string; lineType: 'PEG' | 'BOTTLE' | 'PACKAGED'; quantity: number;
      volumeMl?: number; openBottleId?: string; unitPrice: number; baseAmount: number; taxAmount: number; lineTotal: number; taxSnapshotId: string; taxSnapshotHash: string;
      recipe: { id: string; yieldQuantity: number; lines: Array<{ id: string; productId: string; quantity: number }> } | null;
      modifiers: Array<{id:string;groupId:string;groupName:string;name:string;priceDelta:number;substitutesProductId:string|null;ingredientProductId:string|null;ingredientQuantity:number}>;
    }> = [];
    for (const line of data.lines) {
      const product = await client.query(
        "SELECT id FROM products WHERE id=$1 AND organisation_id=$2 AND status='ACTIVE' FOR UPDATE",
        [line.productId, organisationId]
      );
      if (!product.rowCount) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: { code: 'PRODUCT_NOT_FOUND', message: 'Active product not found' } });
      }
      const availability = await client.query(
        `SELECT is_available FROM bar_menu_availability
          WHERE organisation_id=$1 AND outlet_id=$2 AND product_id=$3 AND measure_type=$4`,
        [organisationId,data.outletId,line.productId,line.lineType]
      );
      if (availability.rowCount && !availability.rows[0].is_available) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: { code: 'MENU_ITEM_UNAVAILABLE', message: 'This menu item is unavailable for the selected measure' } });
      }
      const groups=await client.query(
        `SELECT id,name,min_selections,max_selections,substitutes_product_id FROM bar_modifier_groups
          WHERE organisation_id=$1 AND product_id=$2 AND status='ACTIVE' ORDER BY id`,
        [organisationId,line.productId]
      );
      const modifierRows=line.modifierOptionIds.length?await client.query(
        `SELECT o.id,o.group_id,o.name,o.price_delta,o.ingredient_product_id,o.ingredient_quantity,
                g.name AS group_name,g.substitutes_product_id
           FROM bar_modifier_options o
           JOIN bar_modifier_groups g ON g.id=o.group_id AND g.organisation_id=o.organisation_id
            AND g.product_id=o.product_id AND g.status='ACTIVE'
          WHERE o.organisation_id=$1 AND o.product_id=$2 AND o.status='ACTIVE' AND o.id=ANY($3::uuid[])
          ORDER BY o.id`,
        [organisationId,line.productId,line.modifierOptionIds]
      ): { rows: [], rowCount: 0 };
      if(modifierRows.rowCount!==line.modifierOptionIds.length){
        await client.query('ROLLBACK');
        return res.status(400).json({error:{code:'INVALID_MENU_MODIFIER',message:'One or more selected modifiers are not active for this menu item'}});
      }
      if(line.lineType==='PEG'&&modifierRows.rows.some((option:any)=>option.substitutes_product_id)){
        await client.query('ROLLBACK');
        return res.status(400).json({error:{code:'SUBSTITUTION_NOT_SUPPORTED_FOR_PEG',message:'Ingredient substitutions apply to recipe-based servings, not open-bottle peg pours'}});
      }
      for(const group of groups.rows){
        if(line.lineType==='PEG'&&group.substitutes_product_id)continue;
        const selectedCount=modifierRows.rows.filter((option:any)=>option.group_id===group.id).length;
        if(selectedCount<Number(group.min_selections)||selectedCount>Number(group.max_selections)){
          await client.query('ROLLBACK');
          return res.status(400).json({error:{code:'MODIFIER_SELECTION_REQUIRED',message:`Choose ${group.min_selections}-${group.max_selections} option(s) for ${group.name}`}});
        }
      }
      const modifierAdjustment=modifierRows.rows.reduce((sum:number,option:any)=>sum+Number(option.price_delta),0);
      let recipe: { id: string; yieldQuantity: number; lines: Array<{ id: string; productId: string; quantity: number }> } | null = null;
      if (line.lineType !== 'PEG') {
        const activeRecipe = await client.query(
          `SELECT id,yield_quantity FROM bar_product_recipes
            WHERE organisation_id=$1 AND product_id=$2 AND status='ACTIVE'`,
          [organisationId,line.productId]
        );
        if (activeRecipe.rowCount) {
          const recipeLines = await client.query(
            `SELECT l.id,l.ingredient_product_id,l.quantity
               FROM bar_product_recipe_lines l
               JOIN products ingredient ON ingredient.id=l.ingredient_product_id
                AND ingredient.organisation_id=l.organisation_id AND ingredient.status='ACTIVE'
              WHERE l.organisation_id=$1 AND l.recipe_id=$2 ORDER BY l.id`,
            [organisationId,activeRecipe.rows[0].id]
          );
          if (!recipeLines.rowCount) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: { code: 'ACTIVE_RECIPE_EMPTY', message: 'The active recipe has no active ingredients' } });
          }
          const substitutions=new Set<string>();
          for(const group of groups.rows){
            if(!group.substitutes_product_id)continue;
            const selected=modifierRows.rows.filter((option:any)=>option.group_id===group.id);
            if(selected.length!==1){
              await client.query('ROLLBACK');
              return res.status(400).json({error:{code:'SUBSTITUTION_REQUIRED',message:`Choose one replacement for ${group.name}`}});
            }
            if(!recipeLines.rows.some((row:any)=>row.ingredient_product_id===group.substitutes_product_id)){
              await client.query('ROLLBACK');
              return res.status(409).json({error:{code:'SUBSTITUTION_NOT_IN_RECIPE',message:`${group.name} no longer matches an ingredient in the active recipe`}});
            }
            substitutions.add(group.substitutes_product_id);
          }
          recipe = {
            id: activeRecipe.rows[0].id,
            yieldQuantity: Number(activeRecipe.rows[0].yield_quantity),
            lines: recipeLines.rows.filter((row:any)=>!substitutions.has(row.ingredient_product_id))
              .map((row:any) => ({ id:row.id,productId:row.ingredient_product_id,quantity:Number(row.quantity) }))
          };
        } else if(groups.rows.some((group:any)=>group.substitutes_product_id)){
          await client.query('ROLLBACK');
          return res.status(409).json({error:{code:'SUBSTITUTION_RECIPE_REQUIRED',message:'Substitutions require an active recipe for this menu item'}});
        }
      }
      const quote = await createCheckoutTaxQuote(client,{organisationId,outletId:data.outletId,productId:line.productId,
        actorUserId:req.auth!.userId,channel:'BAR',measureType:line.lineType,quantity:line.quantity,
        priceAdjustmentPerUnit:modifierAdjustment,
        ...(line.lineType==='PEG'&&line.volumeMl?{packSizeMlOverride:line.volumeMl}:{})});
      resolved.push({ ...line, unitPrice:quote.unitPrice, baseAmount:quote.baseAmount, taxAmount:quote.taxAmount, lineTotal:quote.lineTotal,
        taxSnapshotId:quote.snapshotId, taxSnapshotHash:quote.snapshotHash,recipe,
        modifiers:modifierRows.rows.map((option:any)=>({
          id:option.id,groupId:option.group_id,groupName:option.group_name,name:option.name,
          priceDelta:Number(option.price_delta),substitutesProductId:option.substitutes_product_id,
          ingredientProductId:option.ingredient_product_id,
          ingredientQuantity:Number(option.ingredient_quantity)
        })) });
    }

    const totals = calculateBarTotals(resolved);
    const paid = data.payments.reduce((sum, payment) => sum + payment.amount, 0);
    const tabOrder=data.payments.length===0;
    if ((!tabOrder&&Math.abs(paid-totals.grandTotal)>0.01)||(tabOrder&&!data.tableSessionId)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: { code: tabOrder?'TABLE_SESSION_REQUIRED':'PAYMENT_TOTAL_MISMATCH', message: tabOrder?'Unpaid orders must be attached to an open table session':'Payment total must equal the server-calculated ticket total' } });
    }

    const ticket = await client.query(
      `INSERT INTO bar_tickets(organisation_id,outlet_id,ticket_number,table_label,table_session_id,status,subtotal,tax_total,grand_total,opened_by,idempotency_key,request_fingerprint,closed_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,CASE WHEN $6='PAID' THEN NOW() ELSE NULL END) RETURNING *`,
      [organisationId, data.outletId, data.ticketNumber, resolvedTableLabel, data.tableSessionId??null, tabOrder?'SENT':'PAID', totals.subtotal, totals.taxTotal, totals.grandTotal, req.auth!.userId, data.idempotencyKey, fingerprint]
    );
    const ticketId = ticket.rows[0].id;
    await client.query('UPDATE bar_tickets SET excise_decision_id=$1 WHERE id=$2', [compliance.decisionId, ticketId]);
    const kotByStation=new Map<string,string>();
    const persistModifiers=async(ticketLineId:string,line:typeof resolved[number],lineIndex:number)=>{
      for(let modifierIndex=0;modifierIndex<line.modifiers.length;modifierIndex++){
        const modifier=line.modifiers[modifierIndex];
        const saved=await client.query(
          `INSERT INTO bar_ticket_line_modifiers(
             organisation_id,ticket_line_id,group_id,option_id,group_name,option_name,price_delta,
             substitutes_product_id,ingredient_product_id,ingredient_quantity
           ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
          [organisationId,ticketLineId,modifier.groupId,modifier.id,modifier.groupName,modifier.name,
            modifier.priceDelta,modifier.substitutesProductId,modifier.ingredientProductId,modifier.ingredientQuantity]
        );
        if(!modifier.ingredientProductId||modifier.ingredientQuantity<=0)continue;
        const quantity=scaleRecipeQuantity(modifier.ingredientQuantity,1,line.quantity);
        const stock=await client.query(
          `SELECT quantity_units FROM stock_balances
            WHERE organisation_id=$1 AND outlet_id=$2 AND product_id=$3 FOR UPDATE`,
          [organisationId,data.outletId,modifier.ingredientProductId]
        );
        if(!stock.rowCount||Number(stock.rows[0].quantity_units)<quantity){
          throw Object.assign(new Error('Insufficient stock for selected menu modifier'),{code:'MODIFIER_INSUFFICIENT_STOCK'});
        }
        await client.query(
          'UPDATE stock_balances SET quantity_units=quantity_units-$1,updated_at=NOW() WHERE organisation_id=$2 AND outlet_id=$3 AND product_id=$4',
          [quantity,organisationId,data.outletId,modifier.ingredientProductId]
        );
        const movement=await appendStockMovementOnce(client,{
          organisationId,outletId:data.outletId,productId:modifier.ingredientProductId,movementType:'SALE',
          quantityUnits:quantity,referenceType:'BAR_MODIFIER',referenceId:ticketId,
          idempotencyKey:`bar-ticket:${ticketId}:line:${lineIndex}:modifier:${modifierIndex}`,
          notes:`${modifier.groupName}: ${modifier.name}`,createdBy:req.auth!.userId
        });
        await consumeInventoryBatchFefo(client,{
          organisationId,outletId:data.outletId,productId:modifier.ingredientProductId,
          stockMovementId:movement.id,quantityUnits:quantity
        });
        await consumeInventoryCostFifo(client,{
          organisationId,outletId:data.outletId,productId:modifier.ingredientProductId,
          quantityUnits:quantity,sourceType:'BAR_MODIFIER',sourceId:movement.id,movementId:movement.id
        });
        await client.query(
          `INSERT INTO bar_ticket_modifier_consumptions(
             organisation_id,modifier_id,ingredient_product_id,stock_movement_id,quantity_units
           ) VALUES($1,$2,$3,$4,$5)`,
          [organisationId,saved.rows[0].id,modifier.ingredientProductId,movement.id,quantity]
        );
      }
    };

    for (let lineIndex=0;lineIndex<resolved.length;lineIndex++) { const line=resolved[lineIndex];
      let stockMovementId:string|null=null;
      if (line.lineType === 'PEG') {
        const bottle = await client.query(
          `SELECT * FROM open_bottles
            WHERE id=$1 AND outlet_id=$2 AND organisation_id=$3 AND product_id=$4
            FOR UPDATE`,
          [line.openBottleId, data.outletId, organisationId, line.productId]
        );
        if (!bottle.rowCount) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: { code: 'OPEN_BOTTLE_NOT_FOUND', message: 'Open bottle does not match this outlet and product' } });
        }
        if(bottle.rows[0].status!=='OPEN'){
          await client.query('ROLLBACK');
          return res.status(409).json({error:{code:'OPEN_BOTTLE_UNAVAILABLE',message:'Open bottle is no longer available for a pour'}});
        }
        const consumedMl = line.volumeMl! * line.quantity;
        const reserved = await client.query("SELECT COALESCE(SUM(reserved_ml-consumed_ml),0)::int amount FROM bar_bottle_reservations WHERE open_bottle_id=$1 AND status='ACTIVE' AND expires_at>NOW()", [line.openBottleId]);
        const availableMl = Number(bottle.rows[0].remaining_ml) - Number(reserved.rows[0].amount);
        const remaining = Number(bottle.rows[0].remaining_ml) - consumedMl;
        if (availableMl < consumedMl || remaining < 0) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: { code: 'INSUFFICIENT_UNRESERVED_ML', message: 'Open bottle volume is reserved or insufficient for this pour', availableMl: Math.max(0,availableMl) } });
        }
        await client.query(
          `UPDATE open_bottles SET remaining_ml=$1,status=$2,
             closed_at=CASE WHEN $2='EMPTY' THEN NOW() ELSE closed_at END WHERE id=$3`,
          [remaining, remaining === 0 ? 'EMPTY' : 'OPEN', line.openBottleId]
        );
        await client.query(
          `INSERT INTO peg_transactions(organisation_id,outlet_id,open_bottle_id,product_id,volume_ml,transaction_type,reference_id,notes,performed_by)
           VALUES($1,$2,$3,$4,$5,'SALE',$6,'Atomic bar checkout',$7)`,
          [organisationId, data.outletId, line.openBottleId, line.productId, consumedMl, ticketId, req.auth!.userId]
        );
      } else {
        if (line.recipe) {
          const consumptions: Array<{ recipeLineId:string; productId:string; quantity:number; movementId:string }> = [];
          for (const [ingredientIndex,ingredient] of line.recipe.lines.entries()) {
            const quantity = scaleRecipeQuantity(ingredient.quantity,line.recipe.yieldQuantity,line.quantity);
            const stock = await client.query(
              `SELECT quantity_units FROM stock_balances
                WHERE organisation_id=$1 AND outlet_id=$2 AND product_id=$3 FOR UPDATE`,
              [organisationId,data.outletId,ingredient.productId]
            );
            if (!stock.rowCount || Number(stock.rows[0].quantity_units) < quantity) {
              await client.query('ROLLBACK');
              return res.status(409).json({ error: { code: 'INSUFFICIENT_RECIPE_INGREDIENT', message: `Insufficient stock for recipe ingredient ${ingredient.productId}` } });
            }
            await client.query(
              'UPDATE stock_balances SET quantity_units=quantity_units-$1,updated_at=NOW() WHERE organisation_id=$2 AND outlet_id=$3 AND product_id=$4',
              [quantity,organisationId,data.outletId,ingredient.productId]
            );
            const movement=await appendStockMovementOnce(client,{
              organisationId,outletId:data.outletId,productId:ingredient.productId,movementType:'SALE',
              quantityUnits:quantity,referenceType:'BAR_RECIPE',referenceId:ticketId,
              idempotencyKey:`bar-ticket:${ticketId}:line:${lineIndex}:recipe:${ingredient.id}:${ingredientIndex}`,
              notes:`Recipe for ${line.productId}`,createdBy:req.auth!.userId
            });
            await consumeInventoryBatchFefo(client,{
              organisationId,outletId:data.outletId,productId:ingredient.productId,
              stockMovementId:movement.id,quantityUnits:quantity
            });
            await consumeInventoryCostFifo(client,{
              organisationId,outletId:data.outletId,productId:ingredient.productId,quantityUnits:quantity,
              sourceType:'BAR_RECIPE_INGREDIENT',sourceId:movement.id,movementId:movement.id
            });
            consumptions.push({recipeLineId:ingredient.id,productId:ingredient.productId,quantity,movementId:movement.id});
          }
          const ticketLine=await client.query(
            `INSERT INTO bar_ticket_lines(ticket_id,product_id,line_type,quantity,volume_ml,unit_price,tax_amount,line_total,open_bottle_id,tax_snapshot_id,stock_movement_id)
             VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NULL) RETURNING id`,
            [ticketId,line.productId,line.lineType,line.quantity,line.volumeMl??null,line.unitPrice,line.taxAmount,line.lineTotal,line.openBottleId??null,line.taxSnapshotId]
          );
          await persistModifiers(ticketLine.rows[0].id,line,lineIndex);
          for (const consumption of consumptions) await client.query(
            `INSERT INTO bar_ticket_recipe_consumptions(
               organisation_id,outlet_id,ticket_line_id,recipe_id,recipe_line_id,ingredient_product_id,stock_movement_id,quantity_units
             ) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
            [organisationId,data.outletId,ticketLine.rows[0].id,line.recipe.id,consumption.recipeLineId,consumption.productId,consumption.movementId,consumption.quantity]
          );
          const stationResult=await client.query(
            `SELECT COALESCE(
               (SELECT ps.station_id FROM bar_kot_product_stations ps JOIN bar_kot_stations assigned
                  ON assigned.id=ps.station_id AND assigned.organisation_id=ps.organisation_id
                 AND assigned.outlet_id=ps.outlet_id AND assigned.status='ACTIVE'
                WHERE ps.organisation_id=$1 AND ps.outlet_id=$2 AND ps.product_id=$3),
               (SELECT id FROM bar_kot_stations WHERE organisation_id=$1 AND outlet_id=$2 AND is_default AND status='ACTIVE' LIMIT 1)
             ) station_id`,
            [organisationId,data.outletId,line.productId]
          );
          const stationId=stationResult.rows[0].station_id as string|null;
          const stationKey=stationId??'__unrouted__';
          let kotId=kotByStation.get(stationKey);
          if(!kotId){
            const kot=await client.query(
              `INSERT INTO bar_kot_orders(organisation_id,outlet_id,table_session_id,ticket_id,station_id,created_by)
               VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
              [organisationId,data.outletId,data.tableSessionId??null,ticketId,stationId,req.auth!.userId]
            );
            const createdKotId=kot.rows[0]?.id;
            if(!createdKotId)throw new Error('KOT_CREATION_FAILED');
            kotId=createdKotId;
            kotByStation.set(stationKey,createdKotId);
          }
          if(!kotId)throw new Error('KOT_CREATION_FAILED');
          await client.query('INSERT INTO bar_kot_lines(kot_order_id,ticket_line_id,product_id,quantity) VALUES($1,$2,$3,$4)',
            [kotId,ticketLine.rows[0].id,line.productId,line.quantity]);
          continue;
        }
        const stock = await client.query(
          `SELECT quantity_units FROM stock_balances
            WHERE organisation_id=$1 AND outlet_id=$2 AND product_id=$3 FOR UPDATE`,
          [organisationId, data.outletId, line.productId]
        );
        const available = Number(stock.rows[0]?.quantity_units ?? 0);
        if (!stock.rowCount || available < line.quantity) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: { code: 'INSUFFICIENT_STOCK', message: `Insufficient stock for product ${line.productId}` } });
        }
        await client.query(
          'UPDATE stock_balances SET quantity_units=quantity_units-$1,updated_at=NOW() WHERE organisation_id=$2 AND outlet_id=$3 AND product_id=$4',
          [line.quantity, organisationId, data.outletId, line.productId]
        );
        const saleMovement=await appendStockMovementOnce(client,{organisationId,outletId:data.outletId,productId:line.productId,movementType:'SALE',quantityUnits:line.quantity,referenceType:'BAR_TICKET',referenceId:ticketId,idempotencyKey:`bar-ticket:${ticketId}:line:${lineIndex}`,createdBy:req.auth!.userId});
        await consumeInventoryBatchFefo(client,{
          organisationId,outletId:data.outletId,productId:line.productId,
          stockMovementId:saleMovement.id,quantityUnits:line.quantity
        });
        stockMovementId=saleMovement.id;
        await consumeInventoryCostFifo(client,{organisationId,outletId:data.outletId,productId:line.productId,quantityUnits:line.quantity,sourceType:'BAR_TICKET_LINE',sourceId:saleMovement.id,movementId:saleMovement.id});
      }
      const ticketLine=await client.query(
        `INSERT INTO bar_ticket_lines(ticket_id,product_id,line_type,quantity,volume_ml,unit_price,tax_amount,line_total,open_bottle_id,tax_snapshot_id,stock_movement_id)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [ticketId, line.productId, line.lineType, line.quantity, line.volumeMl ?? null, line.unitPrice, line.taxAmount, line.lineTotal, line.openBottleId ?? null,line.taxSnapshotId,stockMovementId]
      );
      await persistModifiers(ticketLine.rows[0].id,line,lineIndex);
      const stationResult=await client.query(
        `SELECT COALESCE(
           (SELECT ps.station_id
              FROM bar_kot_product_stations ps
              JOIN bar_kot_stations assigned ON assigned.id=ps.station_id
               AND assigned.organisation_id=ps.organisation_id AND assigned.outlet_id=ps.outlet_id
               AND assigned.status='ACTIVE'
             WHERE ps.organisation_id=$1 AND ps.outlet_id=$2 AND ps.product_id=$3),
           (SELECT id FROM bar_kot_stations
             WHERE organisation_id=$1 AND outlet_id=$2 AND is_default AND status='ACTIVE'
             LIMIT 1)
         ) station_id`,
        [organisationId,data.outletId,line.productId]
      );
      const stationId=stationResult.rows[0].station_id as string|null;
      const stationKey=stationId??'__unrouted__';
      let kotId=kotByStation.get(stationKey);
      if(!kotId){
        const kot=await client.query(
          `INSERT INTO bar_kot_orders(organisation_id,outlet_id,table_session_id,ticket_id,station_id,created_by)
           VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
          [organisationId,data.outletId,data.tableSessionId??null,ticketId,stationId,req.auth!.userId]
        );
        const insertedKotId=kot.rows[0]?.id;
        if(typeof insertedKotId!=='string')throw new Error('Failed to create a preparation ticket for the checkout line');
        kotId=insertedKotId;
        kotByStation.set(stationKey,insertedKotId);
      }
      if(!kotId)throw new Error('Failed to resolve a preparation ticket for the checkout line');
      await client.query('INSERT INTO bar_kot_lines(kot_order_id,ticket_line_id,product_id,quantity) VALUES($1,$2,$3,$4)',
        [kotId,ticketLine.rows[0].id,line.productId,line.quantity]);
    }

    for (const payment of data.payments) {
      await client.query(
        'INSERT INTO bar_payments(organisation_id,ticket_id,method,amount,reference) VALUES($1,$2,$3,$4,$5)',
        [organisationId, ticketId, payment.method, payment.amount, payment.reference ?? null]
      );
    }
    await client.query(
      `INSERT INTO audit_events(organisation_id,outlet_id,actor_user_id,event_type,entity_type,entity_id,metadata)
       VALUES($1,$2,$3,$4,'BAR_TICKET',$5,$6)`,
      [organisationId,data.outletId,req.auth!.userId,tabOrder?'BAR_TAB_ROUND_ADDED':'BAR_CHECKOUT_COMPLETED',ticketId,{...totals,lineCount:resolved.length,tableSessionId:data.tableSessionId??null}]
    );
    await client.query('COMMIT');
    return res.status(201).json({ data: ticket.rows[0], totals, idempotentReplay: false });
  } catch (error: any) {
    await client.query('ROLLBACK');
    if(typeof error?.code==='string'&&error.code.startsWith('INVENTORY_BATCH_'))return res.status(409).json({error:{code:error.code,message:error.message}});
    if(error?.code==='MODIFIER_INSUFFICIENT_STOCK')return res.status(409).json({error:{code:error.code,message:error.message}});
    if(error?.code==='TAX_CONFIGURATION_INCOMPLETE')return res.status(409).json({error:{code:'TAX_CONFIGURATION_INCOMPLETE',message:'An active tax pack, verified product profile and approved outlet price are required before bar checkout'}});
    if(error instanceof Error&&['INVALID_TAX_INPUT','INVALID_PEG_VOLUME','MRP_EXCEEDED','BAR_MENU_CEILING_REQUIRED','MENU_CEILING_EXCEEDED','ALCOHOL_GST_DOUBLE_CHARGE','GST_COMPONENT_CONFLICT','GST_PAIR_INCOMPLETE'].includes(error.message))return res.status(422).json({error:{code:error.message,message:'Tax calculation rejected this checkout line'}});
    if (error?.code === '23505' && String(error?.constraint ?? '').includes('idempotency')) {
      const replay = await pool.query(
        'SELECT * FROM bar_tickets WHERE organisation_id=$1 AND outlet_id=$2 AND idempotency_key=$3',
        [organisationId, data.outletId, data.idempotencyKey]
      );
      if (replay.rowCount) {
        const [lines,payments]=await Promise.all([
          pool.query('SELECT product_id,line_type,quantity,volume_ml,open_bottle_id FROM bar_ticket_lines WHERE ticket_id=$1 ORDER BY id',[replay.rows[0].id]),
          pool.query('SELECT method,amount,reference FROM bar_payments WHERE ticket_id=$1 ORDER BY created_at,id',[replay.rows[0].id])
        ]);
        const storedFingerprint=replay.rows[0].request_fingerprint?.trim()||createBarCheckoutFingerprint({
          outletId:data.outletId,ticketNumber:replay.rows[0].ticket_number,tableLabel:replay.rows[0].table_label??undefined,tableSessionId:replay.rows[0].table_session_id??undefined,
          lines:lines.rows.map((line:any)=>({productId:line.product_id,lineType:line.line_type,quantity:Number(line.quantity),volumeMl:line.volume_ml===null?undefined:Number(line.volume_ml),openBottleId:line.open_bottle_id??undefined})),
          payments:payments.rows.map((p:any)=>({method:p.method,amount:Number(p.amount),reference:p.reference??undefined}))
        });
        if(storedFingerprint!==fingerprint)
          return res.status(409).json({error:{code:'IDEMPOTENCY_KEY_REUSED',message:'This idempotency key was already used for a different bar checkout'}});
        if(!replay.rows[0].request_fingerprint)await pool.query('UPDATE bar_tickets SET request_fingerprint=$1 WHERE id=$2',[fingerprint,replay.rows[0].id]);
        return res.json({ data: replay.rows[0], lines:lines.rows, payments:payments.rows, idempotentReplay: true });
      }
    }
    throw error;
  } finally {
    client.release();
  }
});
