import { Router } from 'express';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { appendStockMovementOnce } from '../services/stockMovementIdempotency.js';
import { addInventoryCostLayer, consumeInventoryCostFifo } from '../services/inventoryCosting.js';
import { authenticate } from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { requireOrgScope } from '../middleware/requireOrgScope.js';

export const procurementRouter = Router();
procurementRouter.use(authenticate, requireOrgScope);
const uuid=z.string().uuid();
const org=(req:any)=>req.auth.organisationId;
const actor=(req:any)=>req.auth.userId;
const fail=(res:any,code:string,message:string,status=400)=>res.status(status).json({error:{code,message}});
async function audit(client:any,req:any,type:string,id:string,event:string,details:any={}) {
 await client.query(`INSERT INTO procurement_audit_events(organisation_id,actor_user_id,entity_type,entity_id,event_type,details) VALUES($1,$2,$3,$4,$5,$6)`,[org(req),actor(req),type,id,event,details]);
}

procurementRouter.get('/procurement/suppliers',requirePermission('procurement:read'),async(req,res)=>{
 const q=String(req.query.q??'').trim().slice(0,100);
 const r=await pool.query(`SELECT * FROM suppliers WHERE organisation_id=$1 AND ($2='' OR name ILIKE '%'||$2||'%' OR supplier_code ILIKE '%'||$2||'%') ORDER BY name`,[org(req),q]);
 res.json({data:r.rows});
});
procurementRouter.post('/procurement/suppliers',requirePermission('procurement:manage'),async(req,res)=>{
 const s=z.object({name:z.string().trim().min(2).max(160),supplierCode:z.string().trim().min(2).max(40),gstin:z.string().regex(/^[0-9A-Z]{15}$/).optional(),phone:z.string().regex(/^\+?[0-9]{10,15}$/).optional(),email:z.string().email().optional(),paymentTermsDays:z.number().int().min(0).max(365).default(0),contact:z.record(z.any()).default({})}).safeParse(req.body);
 if(!s.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:s.error.flatten()}});
 try { const d=s.data; const r=await pool.query(`INSERT INTO suppliers(organisation_id,name,supplier_code,gstin,phone,email,payment_terms_days,contact) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[org(req),d.name,d.supplierCode,d.gstin??null,d.phone??null,d.email??null,d.paymentTermsDays,d.contact]);
 await pool.query(`INSERT INTO procurement_audit_events(organisation_id,actor_user_id,entity_type,entity_id,event_type) VALUES($1,$2,'SUPPLIER',$3,'SUPPLIER_CREATED')`,[org(req),actor(req),r.rows[0].id]); res.status(201).json({data:r.rows[0]});
 } catch(e:any){if(e.code==='23505')return fail(res,'SUPPLIER_CODE_EXISTS','Supplier code already exists',409);throw e;}
});
procurementRouter.patch('/procurement/suppliers/:supplierId',requirePermission('procurement:manage'),async(req,res)=>{
 const s=z.object({name:z.string().trim().min(2).max(160).optional(),gstin:z.string().regex(/^[0-9A-Z]{15}$/).nullable().optional(),phone:z.string().regex(/^\+?[0-9]{10,15}$/).nullable().optional(),email:z.string().email().nullable().optional(),paymentTermsDays:z.number().int().min(0).max(365).optional(),status:z.enum(['ACTIVE','INACTIVE','SUSPENDED']).optional()}).refine(v=>Object.keys(v).length>0).safeParse(req.body);
 if(!s.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:s.error.flatten()}});
 const d=s.data; const r=await pool.query(`UPDATE suppliers SET name=COALESCE($1,name),gstin=COALESCE($2,gstin),phone=COALESCE($3,phone),email=COALESCE($4,email),payment_terms_days=COALESCE($5,payment_terms_days),status=COALESCE($6,status),updated_at=NOW() WHERE id=$7 AND organisation_id=$8 RETURNING *`,[d.name??null,d.gstin??null,d.phone??null,d.email??null,d.paymentTermsDays??null,d.status??null,req.params.supplierId,org(req)]);
 if(!r.rowCount)return fail(res,'SUPPLIER_NOT_FOUND','Supplier not found',404); res.json({data:r.rows[0]});
});

// P576 supplier return workflow: draft -> approved -> posted with stock/cost evidence.
procurementRouter.post('/procurement/supplier-returns',requirePermission('procurement:manage'),async(req,res)=>{
 const parsed=z.object({outletId:uuid,supplierId:uuid,returnNumber:z.string().trim().min(2).max(60),reason:z.string().trim().min(3).max(1000),
  lines:z.array(z.object({productId:uuid,quantityUnits:z.number().positive(),unitCost:z.number().min(0),reason:z.string().trim().min(3).max(500)})).min(1).max(300)}).safeParse(req.body);
 if(!parsed.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:parsed.error.flatten()}});
 const c=await pool.connect();try{await c.query('BEGIN');
  const o=await c.query('SELECT id FROM outlets WHERE id=$1 AND organisation_id=$2',[parsed.data.outletId,org(req)]);
  const supplier=await c.query('SELECT id FROM suppliers WHERE id=$1 AND organisation_id=$2',[parsed.data.supplierId,org(req)]);
  if(!o.rowCount||!supplier.rowCount){await c.query('ROLLBACK');return fail(res,'INVALID_RETURN_SCOPE','Outlet or supplier not found',404);}
  const ret=await c.query(`INSERT INTO supplier_returns(organisation_id,outlet_id,supplier_id,return_number,reason,created_by)
   VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[org(req),parsed.data.outletId,parsed.data.supplierId,parsed.data.returnNumber,parsed.data.reason,actor(req)]);
  for(const line of parsed.data.lines){
   const product=await c.query('SELECT id FROM products WHERE id=$1 AND organisation_id=$2',[line.productId,org(req)]);
   if(!product.rowCount)throw new Error('RETURN_PRODUCT_INVALID');
   await c.query(`INSERT INTO supplier_return_lines(return_id,product_id,quantity_units,unit_cost,reason) VALUES($1,$2,$3,$4,$5)`,
    [ret.rows[0].id,line.productId,line.quantityUnits,line.unitCost,line.reason]);
  }
  await audit(c,req,'SUPPLIER_RETURN',ret.rows[0].id,'SUPPLIER_RETURN_CREATED',{lineCount:parsed.data.lines.length});
  await c.query('COMMIT');return res.status(201).json({data:ret.rows[0]});
 }catch(e:any){await c.query('ROLLBACK');if(e.code==='23505')return fail(res,'RETURN_NUMBER_EXISTS','Return number already exists',409);if(e.message==='RETURN_PRODUCT_INVALID')return fail(res,'INVALID_PRODUCT','Return product is outside organisation',404);throw e;}finally{c.release();}
});
procurementRouter.get('/procurement/supplier-returns',requirePermission('procurement:read'),async(req,res)=>{
 const r=await pool.query(`SELECT r.*,s.name supplier_name,(SELECT COUNT(*) FROM supplier_return_lines l WHERE l.return_id=r.id) line_count
 FROM supplier_returns r JOIN suppliers s ON s.id=r.supplier_id AND s.organisation_id=r.organisation_id
 WHERE r.organisation_id=$1 ORDER BY r.created_at DESC LIMIT 300`,[org(req)]);
 res.json({data:r.rows});
});
procurementRouter.post('/procurement/supplier-returns/:returnId/approve',requirePermission('procurement:approve'),async(req,res)=>{
 if(Array.isArray(req.params.returnId))return fail(res,'INVALID_RETURN_ID','Return ID must be a single path value',400);
 const returnId=req.params.returnId;
 const c=await pool.connect();try{await c.query('BEGIN');
  const r=await c.query('SELECT * FROM supplier_returns WHERE id=$1 AND organisation_id=$2 FOR UPDATE',[req.params.returnId,org(req)]);
  if(!r.rowCount){await c.query('ROLLBACK');return fail(res,'RETURN_NOT_FOUND','Supplier return not found',404);}
  if(r.rows[0].status!=='DRAFT'){await c.query('ROLLBACK');return fail(res,'INVALID_RETURN_STATE','Only draft returns can be approved',409);}
  if(r.rows[0].created_by===actor(req)){await c.query('ROLLBACK');return fail(res,'MAKER_CHECKER_REQUIRED','Requester cannot approve own supplier return',403);}
  const updated=await c.query(`UPDATE supplier_returns SET status='APPROVED',reviewed_by=$1,reviewed_at=NOW() WHERE id=$2 RETURNING *`,[actor(req),req.params.returnId]);
  await audit(c,req,'SUPPLIER_RETURN',returnId,'SUPPLIER_RETURN_APPROVED');
  await c.query('COMMIT');return res.json({data:updated.rows[0]});
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
});
procurementRouter.post('/procurement/supplier-returns/:returnId/post',requirePermission('procurement:manage'),async(req,res)=>{
 const c=await pool.connect();try{await c.query('BEGIN');
  const r=await c.query('SELECT * FROM supplier_returns WHERE id=$1 AND organisation_id=$2 FOR UPDATE',[req.params.returnId,org(req)]);
  if(!r.rowCount){await c.query('ROLLBACK');return fail(res,'RETURN_NOT_FOUND','Supplier return not found',404);}
  if(r.rows[0].status!=='APPROVED'){await c.query('ROLLBACK');return fail(res,'RETURN_NOT_APPROVED','Return must be approved before posting',409);}
  const lines=await c.query('SELECT * FROM supplier_return_lines WHERE return_id=$1 ORDER BY id FOR UPDATE',[req.params.returnId]);
  for(const line of lines.rows){
   const b=await c.query('SELECT quantity_units FROM stock_balances WHERE organisation_id=$1 AND outlet_id=$2 AND product_id=$3 FOR UPDATE',[org(req),r.rows[0].outlet_id,line.product_id]);
   if(!b.rowCount||Number(b.rows[0].quantity_units)<Number(line.quantity_units)){await c.query('ROLLBACK');return fail(res,'INSUFFICIENT_STOCK','Supplier return exceeds available stock',409);}
   await c.query('UPDATE stock_balances SET quantity_units=quantity_units-$1,updated_at=NOW() WHERE organisation_id=$2 AND outlet_id=$3 AND product_id=$4',[line.quantity_units,org(req),r.rows[0].outlet_id,line.product_id]);
   const movement=await appendStockMovementOnce(c,{organisationId:org(req),outletId:r.rows[0].outlet_id,productId:line.product_id,movementType:'SUPPLIER_RETURN',quantityUnits:Number(line.quantity_units),referenceType:'SUPPLIER_RETURN',referenceId:r.rows[0].id,idempotencyKey:`supplier-return:${r.rows[0].id}:line:${line.id}`,notes:line.reason,createdBy:actor(req)});
   await consumeInventoryCostFifo(c,{organisationId:org(req),outletId:r.rows[0].outlet_id,productId:line.product_id,quantityUnits:Number(line.quantity_units),sourceType:'SUPPLIER_RETURN_LINE',sourceId:line.id,movementId:movement.id});
   await c.query(`INSERT INTO supplier_return_movements(organisation_id,outlet_id,supplier_return_id,return_line_id,stock_movement_id) VALUES($1,$2,$3,$4,$5)`,
    [org(req),r.rows[0].outlet_id,r.rows[0].id,line.id,movement.id]);
  }
  const updated=await c.query(`UPDATE supplier_returns SET status='POSTED',posted_at=NOW() WHERE id=$1 RETURNING *`,[req.params.returnId]);
  await audit(c,req,'SUPPLIER_RETURN',r.rows[0].id,'SUPPLIER_RETURN_POSTED',{lineCount:lines.rowCount});
  await c.query('COMMIT');return res.json({data:updated.rows[0]});
 }catch(e:any){await c.query('ROLLBACK');if(e.code==='23505')return fail(res,'RETURN_ALREADY_POSTED','Supplier return already posted',409);throw e;}finally{c.release();}
});

procurementRouter.get('/procurement/purchase-orders',requirePermission('procurement:read'),async(req,res)=>{
 const r=await pool.query(`SELECT p.*,s.name supplier_name,a.status approval_status FROM purchase_orders p LEFT JOIN suppliers s ON s.id=p.supplier_id AND s.organisation_id=p.organisation_id LEFT JOIN purchase_order_approvals a ON a.purchase_order_id=p.id AND a.organisation_id=p.organisation_id WHERE p.organisation_id=$1 ORDER BY p.created_at DESC LIMIT 300`,[org(req)]);res.json({data:r.rows});
});
procurementRouter.post('/procurement/purchase-orders',requirePermission('procurement:manage'),async(req,res)=>{
 const s=z.object({outletId:uuid,supplierId:uuid,poNumber:z.string().trim().min(2).max(60),expectedAt:z.string().date().optional(),lines:z.array(z.object({productId:uuid,orderedUnits:z.number().positive(),unitCost:z.number().min(0)})).min(1).max(500)}).safeParse(req.body);
 if(!s.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:s.error.flatten()}});
 const c=await pool.connect();try{await c.query('BEGIN');
 const outlet=await c.query('SELECT id FROM outlets WHERE id=$1 AND organisation_id=$2',[s.data.outletId,org(req)]);if(!outlet.rowCount){await c.query('ROLLBACK');return fail(res,'OUTLET_NOT_FOUND','Outlet not found',404);}
 const supplier=await c.query("SELECT id FROM suppliers WHERE id=$1 AND organisation_id=$2 AND status='ACTIVE'",[s.data.supplierId,org(req)]);if(!supplier.rowCount){await c.query('ROLLBACK');return fail(res,'SUPPLIER_NOT_ACTIVE','Active supplier not found',400);}
 const po=await c.query(`INSERT INTO purchase_orders(organisation_id,outlet_id,supplier_id,po_number,expected_at) VALUES($1,$2,$3,$4,$5) RETURNING *`,[org(req),s.data.outletId,s.data.supplierId,s.data.poNumber,s.data.expectedAt??null]);
 for(const line of s.data.lines){const p=await c.query('SELECT id FROM products WHERE id=$1 AND organisation_id=$2',[line.productId,org(req)]);if(!p.rowCount)throw new Error('Product does not belong to organisation');await c.query('INSERT INTO purchase_order_lines(purchase_order_id,product_id,ordered_units,unit_cost) VALUES($1,$2,$3,$4)',[po.rows[0].id,line.productId,line.orderedUnits,line.unitCost]);}
 await audit(c,req,'PURCHASE_ORDER',po.rows[0].id,'PURCHASE_ORDER_CREATED',{lineCount:s.data.lines.length});await c.query('COMMIT');res.status(201).json({data:po.rows[0]});
 }catch(e:any){await c.query('ROLLBACK');if(e.code==='23505')return fail(res,'PO_NUMBER_EXISTS','Purchase order number already exists',409);if(e.message==='Product does not belong to organisation')return fail(res,'INVALID_PRODUCT','One or more products are outside this organisation');throw e;}finally{c.release();}
});
procurementRouter.post('/procurement/purchase-orders/:poId/submit',requirePermission('procurement:manage'),async(req,res)=>{
 if(Array.isArray(req.params.poId))return fail(res,'INVALID_PURCHASE_ORDER_ID','Purchase order ID must be a single path value',400);
 const poId=req.params.poId;
 const c=await pool.connect();try{await c.query('BEGIN');const po=await c.query("SELECT * FROM purchase_orders WHERE id=$1 AND organisation_id=$2 FOR UPDATE",[req.params.poId,org(req)]);if(!po.rowCount){await c.query('ROLLBACK');return fail(res,'PO_NOT_FOUND','Purchase order not found',404);}if(po.rows[0].status!=='DRAFT'){await c.query('ROLLBACK');return fail(res,'INVALID_PO_STATE','Only draft purchase orders can be submitted',409);}const lines=await c.query('SELECT 1 FROM purchase_order_lines l JOIN purchase_orders p ON p.id=l.purchase_order_id AND p.organisation_id=$2 WHERE l.purchase_order_id=$1 LIMIT 1',[req.params.poId,org(req)]);if(!lines.rowCount){await c.query('ROLLBACK');return fail(res,'EMPTY_PO','Add at least one line before submitting');}
 await c.query("UPDATE purchase_orders SET status='SUBMITTED' WHERE id=$1 AND organisation_id=$2",[poId,org(req)]);const a=await c.query(`INSERT INTO purchase_order_approvals(organisation_id,purchase_order_id,requested_by) VALUES($1,$2,$3) ON CONFLICT(purchase_order_id) DO UPDATE SET status='PENDING',requested_by=EXCLUDED.requested_by,requested_at=NOW(),reviewed_by=NULL,reviewed_at=NULL,review_notes=NULL WHERE purchase_order_approvals.organisation_id=EXCLUDED.organisation_id RETURNING *`,[org(req),poId,actor(req)]);await audit(c,req,'PURCHASE_ORDER',poId,'PURCHASE_ORDER_SUBMITTED');await c.query('COMMIT');res.json({data:a.rows[0]});}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
});
procurementRouter.post('/procurement/purchase-orders/:poId/review',requirePermission('procurement:approve'),async(req,res)=>{
 if(Array.isArray(req.params.poId))return fail(res,'INVALID_PURCHASE_ORDER_ID','Purchase order ID must be a single path value',400);
 const poId=req.params.poId;
 const s=z.object({decision:z.enum(['APPROVED','REJECTED']),notes:z.string().max(2000).optional()}).safeParse(req.body);if(!s.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:s.error.flatten()}});
 const c=await pool.connect();try{await c.query('BEGIN');const a=await c.query(`SELECT a.*,p.status po_status FROM purchase_order_approvals a JOIN purchase_orders p ON p.id=a.purchase_order_id WHERE a.purchase_order_id=$1 AND a.organisation_id=$2 FOR UPDATE OF a,p`,[poId,org(req)]);if(!a.rowCount){await c.query('ROLLBACK');return fail(res,'APPROVAL_NOT_FOUND','Submitted approval not found',404);}if(a.rows[0].status!=='PENDING'||a.rows[0].po_status!=='SUBMITTED'){await c.query('ROLLBACK');return fail(res,'INVALID_APPROVAL_STATE','Purchase order is not awaiting approval',409);}const r=await c.query(`UPDATE purchase_order_approvals SET status=$1,reviewed_by=$2,reviewed_at=NOW(),review_notes=$3 WHERE purchase_order_id=$4 AND organisation_id=$5 RETURNING *`,[s.data.decision,actor(req),s.data.notes??null,poId,org(req)]);if(s.data.decision==='REJECTED')await c.query("UPDATE purchase_orders SET status='CANCELLED' WHERE id=$1 AND organisation_id=$2",[poId,org(req)]);await audit(c,req,'PURCHASE_ORDER',poId,`PURCHASE_ORDER_${s.data.decision}`,{notes:s.data.notes??null});await c.query('COMMIT');res.json({data:r.rows[0]});}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
});

procurementRouter.post('/procurement/purchase-orders/:poId/receipts',requirePermission('procurement:manage'),async(req,res)=>{
 const s=z.object({receiptNumber:z.string().trim().min(2).max(60),notes:z.string().max(1000).optional(),lines:z.array(z.object({purchaseOrderLineId:uuid,receivedUnits:z.number().positive(),acceptedUnits:z.number().min(0),unitCost:z.number().min(0),batchNumber:z.string().trim().min(1).max(80).optional(),expiryDate:z.string().date().optional()})).min(1).max(500)}).refine(v=>v.lines.every(x=>x.acceptedUnits<=x.receivedUnits),{message:'Accepted quantity cannot exceed received quantity'}).safeParse(req.body);
 if(!s.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:s.error.flatten()}});
 const requestKey=String(req.get('Idempotency-Key')??'').trim();if(!/^[A-Za-z0-9][A-Za-z0-9._:-]{15,120}$/.test(requestKey))return fail(res,'IDEMPOTENCY_KEY_REQUIRED','Provide a 16-120 character Idempotency-Key header');
 const fingerprint=createHash('sha256').update(JSON.stringify({purchaseOrderId:req.params.poId,...s.data})).digest('hex');
 const c=await pool.connect();try{await c.query('BEGIN');const po=await c.query(`SELECT p.*,a.status approval_status FROM purchase_orders p LEFT JOIN purchase_order_approvals a ON a.purchase_order_id=p.id AND a.organisation_id=p.organisation_id WHERE p.id=$1 AND p.organisation_id=$2 FOR UPDATE OF p`,[req.params.poId,org(req)]);if(!po.rowCount){await c.query('ROLLBACK');return fail(res,'PO_NOT_FOUND','Purchase order not found',404);}if(po.rows[0].approval_status!=='APPROVED'||!['SUBMITTED','PART_RECEIVED','RECEIVED'].includes(po.rows[0].status)){await c.query('ROLLBACK');return fail(res,'PO_NOT_APPROVED','Only approved purchase orders can be received',409);}
 const prior=await c.query(`SELECT * FROM goods_receipts WHERE organisation_id=$1 AND outlet_id=$2 AND idempotency_key=$3 FOR UPDATE`,[org(req),po.rows[0].outlet_id,`goods-receipt:${requestKey}`]);
 if(prior.rowCount){if(prior.rows[0].request_fingerprint!==fingerprint){await c.query('ROLLBACK');return fail(res,'GOODS_RECEIPT_IDEMPOTENCY_CONFLICT','Idempotency key was already used with a different receipt payload',409);}await c.query('COMMIT');return res.status(200).json({data:prior.rows[0],replayed:true});}
 const receipt=await c.query(`INSERT INTO goods_receipts(organisation_id,outlet_id,purchase_order_id,receipt_number,status,received_by,notes,idempotency_key,request_fingerprint) VALUES($1,$2,$3,$4,'DRAFT',$5,$6,$7,$8) RETURNING *`,[org(req),po.rows[0].outlet_id,req.params.poId,s.data.receiptNumber,actor(req),s.data.notes??null,`goods-receipt:${requestKey}`,fingerprint]);
 for(const l of s.data.lines){const line=await c.query(`SELECT pol.*,p.name product_name FROM purchase_order_lines pol JOIN purchase_orders po ON po.id=pol.purchase_order_id AND po.organisation_id=$3 JOIN products p ON p.id=pol.product_id AND p.organisation_id=po.organisation_id WHERE pol.id=$1 AND pol.purchase_order_id=$2 FOR UPDATE`,[l.purchaseOrderLineId,req.params.poId,org(req)]);if(!line.rowCount)throw new Error('PO_LINE_INVALID');const remaining=Number(line.rows[0].ordered_units)-Number(line.rows[0].received_units);if(l.receivedUnits>remaining+0.0001)throw new Error('RECEIPT_EXCEEDS_ORDER');const rejected=l.receivedUnits-l.acceptedUnits;
 const receiptLine=await c.query(`INSERT INTO goods_receipt_lines(goods_receipt_id,purchase_order_line_id,product_id,received_units,accepted_units,rejected_units,unit_cost) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,[receipt.rows[0].id,l.purchaseOrderLineId,line.rows[0].product_id,l.receivedUnits,l.acceptedUnits,rejected,l.unitCost]);
 await c.query(`UPDATE purchase_order_lines SET received_units=received_units+$1 WHERE id=$2 AND purchase_order_id=$3 AND EXISTS (SELECT 1 FROM purchase_orders p WHERE p.id=purchase_order_lines.purchase_order_id AND p.organisation_id=$4)`,[l.receivedUnits,l.purchaseOrderLineId,req.params.poId,org(req)]);
 if(l.acceptedUnits>0){await c.query(`INSERT INTO stock_balances(organisation_id,outlet_id,product_id,quantity_units) VALUES($1,$2,$3,$4) ON CONFLICT(outlet_id,product_id) DO UPDATE SET quantity_units=stock_balances.quantity_units+EXCLUDED.quantity_units,updated_at=NOW() WHERE stock_balances.organisation_id=EXCLUDED.organisation_id`,[org(req),po.rows[0].outlet_id,line.rows[0].product_id,l.acceptedUnits]);await appendStockMovementOnce(c,{organisationId:org(req),outletId:po.rows[0].outlet_id,productId:line.rows[0].product_id,movementType:'RECEIPT',quantityUnits:l.acceptedUnits,referenceType:'GOODS_RECEIPT',referenceId:receipt.rows[0].id,idempotencyKey:`goods-receipt:${receipt.rows[0].id}:line:${receiptLine.rows[0].id}`,notes:`PO ${po.rows[0].po_number}`,createdBy:actor(req)});
 await addInventoryCostLayer(c,{organisationId:org(req),outletId:po.rows[0].outlet_id,productId:line.rows[0].product_id,
  sourceType:'GOODS_RECEIPT',sourceId:receipt.rows[0].id,sourceLineId:receiptLine.rows[0].id,quantityUnits:l.acceptedUnits,unitCost:l.unitCost});
 if(l.batchNumber){await c.query(`INSERT INTO inventory_batches(organisation_id,outlet_id,product_id,batch_number,received_units,remaining_units,expiry_date,created_by) VALUES($1,$2,$3,$4,$5,$5,$6,$7) ON CONFLICT(organisation_id,outlet_id,product_id,batch_number) DO UPDATE SET received_units=inventory_batches.received_units+EXCLUDED.received_units,remaining_units=inventory_batches.remaining_units+EXCLUDED.remaining_units,expiry_date=COALESCE(EXCLUDED.expiry_date,inventory_batches.expiry_date) WHERE inventory_batches.organisation_id=EXCLUDED.organisation_id`,[org(req),po.rows[0].outlet_id,line.rows[0].product_id,l.batchNumber,l.acceptedUnits,l.expiryDate??null,actor(req)]);}}
 }
 await c.query(`UPDATE goods_receipts SET status='POSTED',posted_at=NOW(),posted_by=$1 WHERE id=$2 AND organisation_id=$3`,[actor(req),receipt.rows[0].id,org(req)]);const rem=await c.query(`SELECT COUNT(*)::int n FROM purchase_order_lines l JOIN purchase_orders p ON p.id=l.purchase_order_id AND p.organisation_id=$2 WHERE l.purchase_order_id=$1 AND l.received_units<l.ordered_units`,[req.params.poId,org(req)]);await c.query(`UPDATE purchase_orders SET status=$1 WHERE id=$2 AND organisation_id=$3`,[rem.rows[0].n===0?'RECEIVED':'PART_RECEIVED',req.params.poId,org(req)]);await audit(c,req,'GOODS_RECEIPT',receipt.rows[0].id,'GOODS_RECEIPT_POSTED',{purchaseOrderId:req.params.poId,lines:s.data.lines.length});await c.query('COMMIT');res.status(201).json({data:{...receipt.rows[0],status:'POSTED'}});
 }catch(e:any){await c.query('ROLLBACK');if(e.message==='PO_LINE_INVALID')return fail(res,'PO_LINE_INVALID','Receipt line does not belong to this purchase order');if(e.message==='RECEIPT_EXCEEDS_ORDER')return fail(res,'RECEIPT_EXCEEDS_ORDER','Received quantity exceeds remaining ordered quantity',409);if(e.code==='23505')return fail(res,'RECEIPT_NUMBER_EXISTS','Receipt number or idempotency key already exists',409);throw e;}finally{c.release();}
});
