import { Router } from 'express';
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

export const barCheckoutRouter = Router();
barCheckoutRouter.use(authenticate, requireOrgScope);

const uuid = z.string().uuid();
const lineSchema = z.object({
  productId: uuid,
  lineType: z.enum(['PEG', 'BOTTLE', 'PACKAGED']),
  quantity: z.number().positive(),
  volumeMl: z.number().int().positive().optional(),
  openBottleId: uuid.optional()
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
  })).min(1),
  complianceAttestations: z.object({ ageVerified: z.literal(true), notIntoxicated: z.literal(true), noRestrictedCustomer: z.literal(true), mealProvided: z.literal(true), consumptionOnPremises: z.literal(true).optional() })
});

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
  const ticket=await pool.query('SELECT * FROM bar_tickets WHERE id=$1 AND organisation_id=$2',[req.params.ticketId,req.auth!.organisationId]);
  if(!ticket.rowCount)return res.status(404).json({error:{code:'TICKET_NOT_FOUND'}});
  const [lines,payments,refunds]=await Promise.all([
    pool.query(`SELECT l.*,COALESCE((SELECT SUM(x.volume_ml) FROM bar_refund_peg_restorations x WHERE x.ticket_line_id=l.id),0) quarantined_volume_ml FROM bar_ticket_lines l WHERE l.ticket_id=$1 ORDER BY l.id`,[req.params.ticketId]),
    pool.query('SELECT method,amount,reference FROM bar_payments WHERE ticket_id=$1 ORDER BY created_at,id',[req.params.ticketId]),
    pool.query('SELECT * FROM bar_refunds WHERE ticket_id=$1 ORDER BY created_at,id',[req.params.ticketId])
  ]);
  return res.json({data:{...ticket.rows[0],lines:lines.rows,payments:payments.rows,refunds:refunds.rows}});
});

/**
 * Atomic bar checkout: validates licence, resolves server-side prices, consumes stock/ml,
 * writes ticket lines and payments, and records an audit event in one DB transaction.
 */

// P517: open table sessions are the authoritative table identity for bar service.
barCheckoutRouter.get('/bar/table-sessions', requirePermission('bar:read'), async (req,res) => {
  const outletId=typeof req.query.outletId==='string'?req.query.outletId:null;
  if(!outletId||!uuid.safeParse(outletId).success)return res.status(400).json({error:{code:'INVALID_OUTLET_ID'}});
  const result=await pool.query(
    `SELECT s.*,
       (SELECT COUNT(*)::int FROM bar_tickets t WHERE t.table_session_id=s.id) ticket_count,
       COALESCE((SELECT SUM(t.grand_total) FROM bar_tickets t WHERE t.table_session_id=s.id),0) billed_total,
       (SELECT COUNT(*)::int FROM bar_kot_orders k WHERE k.table_session_id=s.id AND k.status NOT IN ('SERVED','CANCELLED')) pending_kot_count
     FROM bar_table_sessions s WHERE s.organisation_id=$1 AND s.outlet_id=$2
       AND s.status='OPEN' ORDER BY s.opened_at`,
    [req.auth!.organisationId!,outletId]
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
    const session=await client.query("SELECT * FROM bar_table_sessions WHERE id=$1 AND organisation_id=$2 AND status='OPEN' FOR UPDATE",[req.params.sessionId,req.auth!.organisationId]);
    if(!session.rowCount){await client.query('ROLLBACK');return res.status(404).json({error:{code:'OPEN_SESSION_NOT_FOUND'}});}
    const pending=await client.query("SELECT COUNT(*)::int count FROM bar_kot_orders WHERE table_session_id=$1 AND status NOT IN ('SERVED','CANCELLED')",[req.params.sessionId]);
    if(Number(pending.rows[0].count)>0){await client.query('ROLLBACK');return res.status(409).json({error:{code:'KOT_NOT_COMPLETE',message:'All preparation tickets must be served or cancelled before closing the table'} });}
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
  const result=await pool.query(
    `SELECT k.*,t.ticket_number,t.table_label,s.table_label session_table_label,
       COALESCE(json_agg(json_build_object('id',kl.id,'ticketLineId',kl.ticket_line_id,'productId',kl.product_id,'productName',p.name,'quantity',kl.quantity,'instructions',kl.instructions)) FILTER (WHERE kl.id IS NOT NULL),'[]'::json) lines
     FROM bar_kot_orders k JOIN bar_tickets t ON t.id=k.ticket_id
     LEFT JOIN bar_table_sessions s ON s.id=k.table_session_id
     LEFT JOIN bar_kot_lines kl ON kl.kot_order_id=k.id
     LEFT JOIN products p ON p.id=kl.product_id
     WHERE k.organisation_id=$1 AND k.outlet_id=$2 AND k.status<>'CANCELLED'
     GROUP BY k.id,t.ticket_number,t.table_label,s.table_label ORDER BY k.created_at`,
    [req.auth!.organisationId!,outletId]
  );
  return res.json({data:result.rows});
});

barCheckoutRouter.post('/bar/kot/:kotId/status', requirePermission('bar:sell'), async(req,res) => {
  const parsed=z.object({status:z.enum(['ACCEPTED','PREPARING','READY','SERVED','CANCELLED']),reason:z.string().trim().min(3).max(500).optional()}).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:parsed.error.flatten()}});
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const kot=await client.query("SELECT * FROM bar_kot_orders WHERE id=$1 AND organisation_id=$2 FOR UPDATE",[req.params.kotId,req.auth!.organisationId]);
    if(!kot.rowCount){await client.query('ROLLBACK');return res.status(404).json({error:{code:'KOT_NOT_FOUND'}});}
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
        client.query('SELECT product_id,line_type,quantity,volume_ml,open_bottle_id FROM bar_ticket_lines WHERE ticket_id=$1 ORDER BY id', [replay.rows[0].id])
      ]);
      const storedFingerprint=replay.rows[0].request_fingerprint?.trim()||createBarCheckoutFingerprint({
        outletId:data.outletId,ticketNumber:replay.rows[0].ticket_number,tableLabel:replay.rows[0].table_label??undefined,tableSessionId:replay.rows[0].table_session_id??undefined,
        lines:lines.rows.map((line:any)=>({productId:line.product_id,lineType:line.line_type,quantity:Number(line.quantity),volumeMl:line.volume_ml===null?undefined:Number(line.volume_ml),openBottleId:line.open_bottle_id??undefined})),
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
      const quote = await createCheckoutTaxQuote(client,{organisationId,outletId:data.outletId,productId:line.productId,
        actorUserId:req.auth!.userId,channel:'BAR',measureType:line.lineType,quantity:line.quantity,
        ...(line.lineType==='PEG'&&line.volumeMl?{packSizeMlOverride:line.volumeMl}:{})});
      resolved.push({ ...line, unitPrice:quote.unitPrice, baseAmount:quote.baseAmount, taxAmount:quote.taxAmount, lineTotal:quote.lineTotal,
        taxSnapshotId:quote.snapshotId, taxSnapshotHash:quote.snapshotHash });
    }

    const totals = calculateBarTotals(resolved);
    const paid = data.payments.reduce((sum, payment) => sum + payment.amount, 0);
    if (Math.abs(paid - totals.grandTotal) > 0.01) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: { code: 'PAYMENT_TOTAL_MISMATCH', message: 'Payment total must equal the server-calculated ticket total' } });
    }

    const ticket = await client.query(
      `INSERT INTO bar_tickets(organisation_id,outlet_id,ticket_number,table_label,table_session_id,status,subtotal,tax_total,grand_total,opened_by,idempotency_key,request_fingerprint,closed_at)
       VALUES($1,$2,$3,$4,$5,'PAID',$6,$7,$8,$9,$10,$11,NOW()) RETURNING *`,
      [organisationId, data.outletId, data.ticketNumber, resolvedTableLabel, data.tableSessionId??null, totals.subtotal, totals.taxTotal, totals.grandTotal, req.auth!.userId, data.idempotencyKey, fingerprint]
    );
    const ticketId = ticket.rows[0].id;
    await client.query('UPDATE bar_tickets SET excise_decision_id=$1 WHERE id=$2', [compliance.decisionId, ticketId]);
    const kot=await client.query(
      `INSERT INTO bar_kot_orders(organisation_id,outlet_id,table_session_id,ticket_id,created_by)
       VALUES($1,$2,$3,$4,$5) RETURNING id`,
      [organisationId,data.outletId,data.tableSessionId??null,ticketId,req.auth!.userId]
    );

    for (let lineIndex=0;lineIndex<resolved.length;lineIndex++) { const line=resolved[lineIndex];
      if (line.lineType === 'PEG') {
        const bottle = await client.query(
          `SELECT * FROM open_bottles
            WHERE id=$1 AND outlet_id=$2 AND organisation_id=$3 AND product_id=$4 AND status='OPEN'
            FOR UPDATE`,
          [line.openBottleId, data.outletId, organisationId, line.productId]
        );
        if (!bottle.rowCount) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: { code: 'OPEN_BOTTLE_NOT_FOUND', message: 'Open bottle does not match this outlet and product' } });
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
        await consumeInventoryCostFifo(client,{organisationId,outletId:data.outletId,productId:line.productId,quantityUnits:line.quantity,sourceType:'BAR_TICKET_LINE',sourceId:saleMovement.id,movementId:saleMovement.id});
      }
      const ticketLine=await client.query(
        `INSERT INTO bar_ticket_lines(ticket_id,product_id,line_type,quantity,volume_ml,unit_price,tax_amount,line_total,open_bottle_id,tax_snapshot_id)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [ticketId, line.productId, line.lineType, line.quantity, line.volumeMl ?? null, line.unitPrice, line.taxAmount, line.lineTotal, line.openBottleId ?? null,line.taxSnapshotId]
      );
      await client.query('INSERT INTO bar_kot_lines(kot_order_id,ticket_line_id,product_id,quantity) VALUES($1,$2,$3,$4)',
        [kot.rows[0].id,ticketLine.rows[0].id,line.productId,line.quantity]);
    }

    for (const payment of data.payments) {
      await client.query(
        'INSERT INTO bar_payments(organisation_id,ticket_id,method,amount,reference) VALUES($1,$2,$3,$4,$5)',
        [organisationId, ticketId, payment.method, payment.amount, payment.reference ?? null]
      );
    }
    await client.query(
      `INSERT INTO audit_events(organisation_id,outlet_id,actor_user_id,event_type,entity_type,entity_id,metadata)
       VALUES($1,$2,$3,'BAR_CHECKOUT_COMPLETED','BAR_TICKET',$4,$5)`,
      [organisationId, data.outletId, req.auth!.userId, ticketId, { ...totals, lineCount: resolved.length }]
    );
    await client.query('COMMIT');
    return res.status(201).json({ data: ticket.rows[0], totals, idempotentReplay: false });
  } catch (error: any) {
    await client.query('ROLLBACK');
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
