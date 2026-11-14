import { createHash } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { pool } from '../db/pool.js';
import { appendStockMovementOnce } from '../services/stockMovementIdempotency.js';
import { collectStockReconciliation } from '../services/stockReconciliation.js';
import { addInventoryCostLayer, consumeInventoryCostFifo } from '../services/inventoryCosting.js';
import { authenticate } from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { requireOrgScope } from '../middleware/requireOrgScope.js';
import { checkOutletOperationalAccess } from '../services/outletOperationalAccess.js';
import { calculateRetailLineAmounts, calculateRetailPaymentTotal, createRetailCheckoutFingerprint } from '../services/retailCheckoutIntegrity.js';
import { evaluateExciseSale } from '../services/exciseCompliance.js';
import { createCheckoutTaxQuote } from '../services/taxQuote.js';

export const operationsRouter = Router();
operationsRouter.use(authenticate, requireOrgScope);

const uuid = z.string().uuid();
const fail = (res: any, code: string, message: string, status = 400) =>
  res.status(status).json({ error: { code, message } });
const orgId = (req: any) => req.auth.organisationId;

operationsRouter.post('/organisations', requirePermission('organisation:manage'), async (req, res) => {
  if (!req.auth!.isPlatformAdmin) return fail(res,'PLATFORM_ADMIN_REQUIRED','Only platform administrators can create organisations',403);
  const s = z.object({ name:z.string().min(2).max(160), legalName:z.string().max(200).optional(),
    type:z.enum(['RETAILER','BAR_OPERATOR','BRAND','DISTRIBUTOR','PLATFORM']), profile:z.enum(['RETAIL_ONLY','BAR_ONLY','HYBRID']).default('RETAIL_ONLY'), gstin:z.string().max(20).optional() }).safeParse(req.body);
  if (!s.success) return res.status(400).json({error:{code:'VALIDATION_ERROR',details:s.error.flatten()}});
  const r = await pool.query(`INSERT INTO organisations(name,legal_name,organisation_type,gstin,status)
    VALUES($1,$2,$3,$4,'PENDING') RETURNING *`,[s.data.name,s.data.legalName ?? null,s.data.type,s.data.gstin ?? null]);
  return res.status(201).json({data:r.rows[0]});
});
operationsRouter.get('/organisations', requirePermission('organisation:read'), async (req,res) => {
  if (req.auth!.isPlatformAdmin) {
    const r=await pool.query('SELECT id,name,legal_name,organisation_type,status,created_at FROM organisations ORDER BY created_at DESC');
    return res.json({data:r.rows});
  }
  const r=await pool.query('SELECT id,name,legal_name,organisation_type,status,created_at FROM organisations WHERE id=$1',[orgId(req)]);
  return res.json({data:r.rows});
});
operationsRouter.post('/outlets', requirePermission('outlet:manage'), async (req,res) => {
  const s=z.object({organisationId:uuid.optional(),code:z.string().min(2).max(40),name:z.string().min(2).max(160),
    type:z.enum(['RETAIL','BAR','HYBRID']),operatingMode:z.enum(['RETAIL_ONLY','BAR_ONLY','HYBRID']),stateCode:z.string().length(2),address:z.record(z.any()).optional()}).safeParse(req.body);
  if(!s.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:s.error.flatten()}});
  const targetOrganisationId=req.auth!.isPlatformAdmin ? (s.data.organisationId ?? null) : orgId(req);
  if(!targetOrganisationId)return fail(res,'ORGANISATION_REQUIRED','An organisation must be selected for outlet creation');
  const r=await pool.query(`INSERT INTO outlets(organisation_id,outlet_code,name,outlet_type,operating_mode,state_code,address)
    VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [targetOrganisationId,s.data.code,s.data.name,s.data.type,s.data.operatingMode,s.data.stateCode,s.data.address ?? {}]);
  res.status(201).json({data:r.rows[0]});
});
operationsRouter.post('/outlets/:outletId/status', requirePermission('outlet:manage'), async(req,res)=>{
  if(!req.auth!.isPlatformAdmin)return fail(res,'PLATFORM_ADMIN_REQUIRED','Outlet activation requires platform review',403);
  const s=z.object({status:z.enum(['ACTIVE','SUSPENDED','CLOSED'])}).safeParse(req.body);
  if(!s.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:s.error.flatten()}});
  const r=await pool.query('UPDATE outlets SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING *',[s.data.status,req.params.outletId]);
  if(!r.rowCount)return fail(res,'OUTLET_NOT_FOUND','Outlet not found',404);
  res.json({data:r.rows[0]});
});
operationsRouter.get('/outlets', requirePermission('outlet:read'), async(req,res)=>{
  const r=await pool.query('SELECT * FROM outlets WHERE organisation_id=$1 ORDER BY created_at DESC',[orgId(req)]);
  res.json({data:r.rows});
});
operationsRouter.post('/outlets/:outletId/licences', requirePermission('licence:manage'), async(req,res)=>{
  const s=z.object({licenceType:z.string().trim().min(2).max(100),licenceNumber:z.string().trim().min(2).max(120),authority:z.string().trim().max(160).optional(),
    validFrom:z.string().date().optional(),validUntil:z.string().date().optional(),activities:z.array(z.enum(['RETAIL_SALE','BAR_SERVICE'])).min(1).max(2),evidenceUri:z.string().url().optional()})
    .refine(v=>!v.validFrom||!v.validUntil||v.validUntil>=v.validFrom,{message:'validUntil must be on or after validFrom',path:['validUntil']}).safeParse(req.body);
  if(!s.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:s.error.flatten()}});
  const outlet=await pool.query('SELECT id,state_code FROM outlets WHERE id=$1 AND organisation_id=$2',[req.params.outletId,orgId(req)]);
  if(!outlet.rowCount)return fail(res,'OUTLET_NOT_FOUND','Outlet not found',404);
  const r=await pool.query(`INSERT INTO outlet_licences(organisation_id,outlet_id,jurisdiction_code,licence_type,licence_number,issuing_authority,valid_from,valid_until,permitted_activities,evidence_uri)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,[orgId(req),req.params.outletId,outlet.rows[0].state_code,s.data.licenceType,s.data.licenceNumber,s.data.authority ?? null,s.data.validFrom ?? null,s.data.validUntil ?? null,s.data.activities,s.data.evidenceUri ?? null]);
  res.status(201).json({data:r.rows[0]});
});
operationsRouter.post('/licences/:licenceId/review', requirePermission('licence:review'), async(req,res)=>{
  if(!req.auth!.isPlatformAdmin)return fail(res,'PLATFORM_ADMIN_REQUIRED','Licence verification requires platform review',403);
  const s=z.object({decision:z.enum(['VERIFIED','REJECTED','UNDER_REVIEW','SUSPENDED']),notes:z.string().max(2000).optional()}).safeParse(req.body);
  if(!s.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:s.error.flatten()}});
  const r=await pool.query(`UPDATE outlet_licences SET status=$1,review_notes=$2,reviewed_by=$3,reviewed_at=NOW()
    WHERE id=$4 RETURNING *`,[s.data.decision,s.data.notes ?? null,req.auth!.userId,req.params.licenceId]);
  if(!r.rowCount)return fail(res,'LICENCE_NOT_FOUND','Licence not found',404);
  await pool.query(`INSERT INTO audit_events(organisation_id,outlet_id,actor_user_id,event_type,entity_type,entity_id,reason,metadata)
    VALUES($1,$2,$3,'OUTLET_LICENCE_REVIEWED','OUTLET_LICENCE',$4,$5,$6)`,
    [r.rows[0].organisation_id,r.rows[0].outlet_id,req.auth!.userId,r.rows[0].id,s.data.notes ?? null,{decision:s.data.decision}]);
  res.json({data:r.rows[0]});
});
operationsRouter.get('/outlets/:outletId/licences', requirePermission('licence:read'), async(req,res)=>{
 const r=await pool.query('SELECT * FROM outlet_licences WHERE outlet_id=$1 AND organisation_id=$2',[req.params.outletId,orgId(req)]);
 res.json({data:r.rows});
});

// P05 catalogue
operationsRouter.post('/catalogue/products',requirePermission('catalogue:manage'),async(req,res)=>{
 const s=z.object({sku:z.string().min(1).max(64),barcode:z.string().max(64).optional(),name:z.string().min(2).max(180),
 brand:z.string().optional(),categoryId:uuid.optional(),productType:z.string().default('SPIRIT'),
 packSizeMl:z.number().int().positive(),unitsPerCase:z.number().int().positive().default(1),abv:z.number().min(0).max(100).optional(),
 hsnCode:z.string().optional(),taxCode:z.string().optional()}).safeParse(req.body);
 if(!s.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:s.error.flatten()}});
 const d=s.data; const r=await pool.query(`INSERT INTO products(organisation_id,sku,barcode,name,brand,category_id,product_type,pack_size_ml,units_per_case,abv,hsn_code,tax_code)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
 [orgId(req),d.sku,d.barcode ?? null,d.name,d.brand ?? null,d.categoryId ?? null,d.productType,d.packSizeMl,d.unitsPerCase,d.abv ?? null,d.hsnCode ?? null,d.taxCode ?? null]);
 res.status(201).json({data:r.rows[0]});
});
operationsRouter.get('/catalogue/products',requirePermission('catalogue:read'),async(req,res)=>{
 const q=String(req.query.q ?? '').slice(0,100);
 const r=await pool.query(`SELECT * FROM products WHERE organisation_id=$1 AND status='ACTIVE'
 AND ($2='' OR name ILIKE '%'||$2||'%' OR sku ILIKE '%'||$2||'%' OR COALESCE(barcode,'') ILIKE '%'||$2||'%')
 ORDER BY name LIMIT 250`,[orgId(req),q]); res.json({data:r.rows});
});
operationsRouter.patch('/catalogue/products/:productId',requirePermission('catalogue:manage'),async(req,res)=>{
 const s=z.object({name:z.string().min(2).optional(),barcode:z.string().optional(),status:z.enum(['ACTIVE','ARCHIVED']).optional(),packSizeMl:z.number().int().positive().optional()}).safeParse(req.body);
 if(!s.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:s.error.flatten()}});
 const d=s.data; const r=await pool.query(`UPDATE products SET name=COALESCE($1,name),barcode=COALESCE($2,barcode),status=COALESCE($3,status),pack_size_ml=COALESCE($4,pack_size_ml),updated_at=NOW()
 WHERE id=$5 AND organisation_id=$6 RETURNING *`,[d.name ?? null,d.barcode ?? null,d.status ?? null,d.packSizeMl ?? null,req.params.productId,orgId(req)]);
 if(!r.rowCount)return fail(res,'PRODUCT_NOT_FOUND','Product not found',404); res.json({data:r.rows[0]});
});

// P571: establish an auditable opening baseline from the current outlet balances.
// Baseline capture is one-time and does not mutate balances or ledger rows.
operationsRouter.post('/inventory/opening-balance-snapshots',requirePermission('inventory:adjust'),async(req,res)=>{
 const s=z.object({outletId:uuid,reason:z.string().trim().min(3).max(500)}).safeParse(req.body);
 if(!s.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:s.error.flatten()}});
 const client=await pool.connect();
 try{await client.query('BEGIN');
  const outlet=await client.query('SELECT id FROM outlets WHERE id=$1 AND organisation_id=$2 FOR UPDATE',[s.data.outletId,orgId(req)]);
  await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1::text || ':' || $2::text,0))`,[orgId(req),s.data.outletId]);
  if(!outlet.rowCount){await client.query('ROLLBACK');return fail(res,'OUTLET_NOT_FOUND','Outlet not found',404);}
  const prior=await client.query('SELECT id FROM stock_opening_balance_snapshots WHERE organisation_id=$1 AND outlet_id=$2',[orgId(req),s.data.outletId]);
  if(prior.rowCount){await client.query('ROLLBACK');return fail(res,'OPENING_BASELINE_ALREADY_EXISTS','Opening baseline is immutable and already exists',409);}
  const snap=await client.query(`INSERT INTO stock_opening_balance_snapshots(organisation_id,outlet_id,captured_by,reason,captured_at)
   VALUES($1,$2,$3,$4,clock_timestamp()) RETURNING *`,[orgId(req),s.data.outletId,req.auth!.userId,s.data.reason]);
  await client.query(`INSERT INTO stock_opening_balance_lines(snapshot_id,organisation_id,outlet_id,product_id,quantity_units)
   SELECT $1,organisation_id,outlet_id,product_id,quantity_units FROM stock_balances WHERE organisation_id=$2 AND outlet_id=$3`,[snap.rows[0].id,orgId(req),s.data.outletId]);
  await client.query('COMMIT');return res.status(201).json({data:snap.rows[0]});
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
});

// P570: read-only ledger/balance reconciliation. Findings are recorded for investigation;
// this endpoint never mutates stock balances or stock movements.
operationsRouter.post('/inventory/reconciliation-runs',requirePermission('inventory:read'),async(req,res)=>{
 const s=z.object({outletId:uuid,notes:z.string().max(1000).optional()}).safeParse(req.body);
 if(!s.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:s.error.flatten()}});
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  const outlet=await client.query('SELECT id FROM outlets WHERE id=$1 AND organisation_id=$2 FOR SHARE',[s.data.outletId,orgId(req)]);
  await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1::text || ':' || $2::text,0))`,[orgId(req),s.data.outletId]);
  const cutoff=await client.query('SELECT clock_timestamp() AS cutoff_at');
  const baseline=await client.query('SELECT id FROM stock_opening_balance_snapshots WHERE organisation_id=$1 AND outlet_id=$2',[orgId(req),s.data.outletId]);
  if(!outlet.rowCount){await client.query('ROLLBACK');return fail(res,'OUTLET_NOT_FOUND','Outlet not found',404);}
  const rows=await collectStockReconciliation(client,orgId(req),s.data.outletId,cutoff.rows[0].cutoff_at);
  const pending:any[]=[];
  for(const row of rows){
   const balance=Number(row.balance_quantity),ledger=Number(row.ledger_quantity),variance=Number((balance-ledger).toFixed(3));
   if(row.missing_balance) pending.push({productId:row.product_id,type:'MISSING_BALANCE_ROW',severity:'WARNING',ledger,balance:0,variance:null});
   if(balance<0) pending.push({productId:row.product_id,type:'NEGATIVE_BALANCE',severity:'CRITICAL',ledger,balance,variance});
   if(Math.abs(variance)>0.0005) pending.push({productId:row.product_id,type:'BALANCE_LEDGER_VARIANCE',severity:'WARNING',ledger,balance,variance});
   if(Number(row.unclassified_adjustments)>0) pending.push({productId:row.product_id,type:'UNCLASSIFIED_ADJUSTMENT',severity:'INFO',ledger,balance,variance:null});
  }
  const run=await client.query(`INSERT INTO stock_reconciliation_runs(organisation_id,outlet_id,status,started_by,product_count,exception_count,notes,ledger_cutoff_at,baseline_snapshot_id)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[orgId(req),s.data.outletId,pending.length?'COMPLETED_WITH_EXCEPTIONS':'COMPLETED',req.auth!.userId,rows.length,pending.length,s.data.notes??null,cutoff.rows[0].cutoff_at,baseline.rows[0]?.id??null]);
  for(const e of pending) await client.query(`INSERT INTO stock_reconciliation_exceptions
   (organisation_id,outlet_id,run_id,product_id,exception_type,severity,ledger_quantity,balance_quantity,variance_quantity)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[orgId(req),s.data.outletId,run.rows[0].id,e.productId,e.type,e.severity,e.ledger,e.balance,e.variance]);
  await client.query('COMMIT');
  return res.status(201).json({data:{run:run.rows[0],exceptions:pending,limitations:['ADJUSTMENT movements are excluded from arithmetic because historical rows do not persist adjustment sign.','Opening baseline is outlet-specific and immutable; products without a balance row are treated as zero at capture time.','No automatic balance correction is performed.']}});
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
});
operationsRouter.get('/inventory/reconciliation-runs',requirePermission('inventory:read'),async(req,res)=>{
 const outletId=typeof req.query.outletId==='string'?req.query.outletId:null;
 const r=await pool.query(`SELECT * FROM stock_reconciliation_runs WHERE organisation_id=$1 AND ($2::uuid IS NULL OR outlet_id=$2) ORDER BY completed_at DESC LIMIT 100`,[orgId(req),outletId]);
 res.json({data:r.rows});
});
operationsRouter.get('/inventory/reconciliation-exceptions',requirePermission('inventory:read'),async(req,res)=>{
 const outletId=typeof req.query.outletId==='string'?req.query.outletId:null;
 const status=typeof req.query.status==='string'?req.query.status:'OPEN';
 const r=await pool.query(`SELECT e.*,p.sku,p.name FROM stock_reconciliation_exceptions e LEFT JOIN products p ON p.id=e.product_id AND p.organisation_id=e.organisation_id
 WHERE e.organisation_id=$1 AND ($2::uuid IS NULL OR e.outlet_id=$2) AND ($3='ALL' OR e.status=$3) ORDER BY e.created_at DESC LIMIT 500`,[orgId(req),outletId,status]);
 res.json({data:r.rows});
});
operationsRouter.post('/inventory/reconciliation-exceptions/:exceptionId/status',requirePermission('inventory:adjust'),async(req,res)=>{
 const s=z.object({status:z.enum(['INVESTIGATING','RESOLVED','ACCEPTED']),notes:z.string().trim().min(3).max(2000)}).safeParse(req.body);
 if(!s.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:s.error.flatten()}});
 const r=await pool.query(`UPDATE stock_reconciliation_exceptions SET status=$1,resolution_notes=$2,resolved_by=$3,resolved_at=CASE WHEN $1 IN ('RESOLVED','ACCEPTED') THEN NOW() ELSE NULL END
 WHERE id=$4 AND organisation_id=$5 RETURNING *`,[s.data.status,s.data.notes,req.auth!.userId,req.params.exceptionId,orgId(req)]);
 if(!r.rowCount)return fail(res,'RECONCILIATION_EXCEPTION_NOT_FOUND','Exception not found',404);
 res.json({data:r.rows[0]});
});

// P574: maker-checker variance correction requests. Request creation never changes stock.
operationsRouter.post('/inventory/variance-correction-requests',requirePermission('inventory:adjust'),async(req,res)=>{
 const parsed=z.object({exceptionId:uuid,delta:z.number().refine(n=>Number.isFinite(n)&&n!==0),reason:z.string().trim().min(3).max(1000),evidenceReference:z.string().trim().max(240).optional()}).safeParse(req.body);
 if(!parsed.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:parsed.error.flatten()}});
 const key=String(req.get('Idempotency-Key')??'').trim();
 if(!/^[A-Za-z0-9][A-Za-z0-9._:-]{15,120}$/.test(key))return fail(res,'IDEMPOTENCY_KEY_REQUIRED','Provide a 16-120 character Idempotency-Key header');
 const d=parsed.data, client=await pool.connect();
 const fingerprint=createHash('sha256').update(JSON.stringify({exceptionId:d.exceptionId,delta:d.delta,reason:d.reason,evidenceReference:d.evidenceReference??null})).digest('hex');
 try{
  await client.query('BEGIN');
  const ex=await client.query(`SELECT id,organisation_id,outlet_id,product_id,status FROM stock_reconciliation_exceptions
   WHERE id=$1 AND organisation_id=$2 FOR UPDATE`,[d.exceptionId,orgId(req)]);
  if(!ex.rowCount){await client.query('ROLLBACK');return fail(res,'RECONCILIATION_EXCEPTION_NOT_FOUND','Exception not found',404);}
  if(!ex.rows[0].product_id){await client.query('ROLLBACK');return fail(res,'PRODUCT_REQUIRED','This exception cannot be corrected against a product',409);}
  const prior=await client.query(`SELECT * FROM stock_variance_correction_requests WHERE organisation_id=$1 AND outlet_id=$2 AND idempotency_key=$3`,
   [orgId(req),ex.rows[0].outlet_id,key]);
  if(prior.rowCount){
   if(prior.rows[0].request_fingerprint!==fingerprint){await client.query('ROLLBACK');return fail(res,'IDEMPOTENCY_KEY_CONFLICT','Idempotency key was used with a different correction request',409);}
   await client.query('COMMIT');return res.status(200).json({data:prior.rows[0],replayed:true});
  }
  const created=await client.query(`INSERT INTO stock_variance_correction_requests
   (organisation_id,outlet_id,exception_id,product_id,requested_delta,reason,evidence_reference,requested_by,idempotency_key,request_fingerprint)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
   [orgId(req),ex.rows[0].outlet_id,d.exceptionId,ex.rows[0].product_id,d.delta,d.reason,d.evidenceReference??null,req.auth!.userId,key,fingerprint]);
  await client.query(`UPDATE stock_reconciliation_exceptions SET status='INVESTIGATING',last_reviewed_at=NOW(),last_reviewed_by=$1 WHERE id=$2 AND organisation_id=$3`,
   [req.auth!.userId,d.exceptionId,orgId(req)]);
  await client.query('COMMIT');return res.status(201).json({data:created.rows[0],replayed:false});
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
});
operationsRouter.get('/inventory/variance-correction-requests',requirePermission('inventory:read'),async(req,res)=>{
 const status=typeof req.query.status==='string'?req.query.status:'ALL';
 const outletId=typeof req.query.outletId==='string'?req.query.outletId:null;
 const r=await pool.query(`SELECT * FROM stock_variance_correction_requests WHERE organisation_id=$1
  AND ($2::uuid IS NULL OR outlet_id=$2) AND ($3='ALL' OR status=$3) ORDER BY created_at DESC LIMIT 250`,
  [orgId(req),outletId,status]);
 res.json({data:r.rows});
});
operationsRouter.post('/inventory/variance-correction-requests/:requestId/approve',requirePermission('inventory:adjust'),async(req,res)=>{
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  const q=await client.query(`SELECT * FROM stock_variance_correction_requests
   WHERE id=$1 AND organisation_id=$2 FOR UPDATE`,[req.params.requestId,orgId(req)]);
  if(!q.rowCount){await client.query('ROLLBACK');return fail(res,'CORRECTION_REQUEST_NOT_FOUND','Correction request not found',404);}
  const request=q.rows[0];
  if(request.status==='APPROVED'){await client.query('COMMIT');return res.status(200).json({data:request,replayed:true});}
  if(request.status!=='PENDING'){await client.query('ROLLBACK');return fail(res,'CORRECTION_NOT_PENDING','Only pending corrections can be approved',409);}
  if(request.requested_by===req.auth!.userId){await client.query('ROLLBACK');return fail(res,'MAKER_CHECKER_REQUIRED','The requester cannot approve their own correction',403);}
  await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1::text || ':' || $2::text,0))`,[orgId(req),request.outlet_id]);
  const bal=await client.query(`SELECT quantity_units FROM stock_balances WHERE organisation_id=$1 AND outlet_id=$2 AND product_id=$3 FOR UPDATE`,
   [orgId(req),request.outlet_id,request.product_id]);
  const current=Number(bal.rows[0]?.quantity_units??0), next=Number((current+Number(request.requested_delta)).toFixed(3));
  if(next<0){await client.query('ROLLBACK');return fail(res,'INSUFFICIENT_STOCK','Correction would make stock negative',409);}
  const movement=await appendStockMovementOnce(client,{organisationId:orgId(req),outletId:request.outlet_id,productId:request.product_id,
   movementType:'ADJUSTMENT',quantityUnits:Math.abs(Number(request.requested_delta)),adjustmentDirection:Number(request.requested_delta)>0?'INCREASE':'DECREASE',
   referenceType:'VARIANCE_CORRECTION',referenceId:request.id,notes:request.reason,idempotencyKey:`variance-correction:${request.id}`,createdBy:req.auth!.userId});
  if(movement.created)await client.query(`INSERT INTO stock_balances(organisation_id,outlet_id,product_id,quantity_units)
   VALUES($1,$2,$3,$4) ON CONFLICT(outlet_id,product_id) DO UPDATE SET quantity_units=EXCLUDED.quantity_units,updated_at=NOW()
   WHERE stock_balances.organisation_id=EXCLUDED.organisation_id`,[orgId(req),request.outlet_id,request.product_id,next]);
  const updated=await client.query(`UPDATE stock_variance_correction_requests SET status='APPROVED',approved_by=$1,approved_at=NOW(),
   stock_movement_id=$2,updated_at=NOW() WHERE id=$3 AND organisation_id=$4 RETURNING *`,
   [req.auth!.userId,movement.id,request.id,orgId(req)]);
  await client.query(`UPDATE stock_reconciliation_exceptions SET status='RESOLVED',resolution_notes=$1,resolved_by=$2,resolved_at=NOW(),
   last_reviewed_at=NOW(),last_reviewed_by=$2 WHERE id=$3 AND organisation_id=$4`,
   [`Approved stock correction ${request.id}; movement ${movement.id}`,req.auth!.userId,request.exception_id,orgId(req)]);
  await client.query('COMMIT');return res.status(200).json({data:updated.rows[0],balance:next,replayed:!movement.created});
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
});
operationsRouter.post('/inventory/variance-correction-requests/:requestId/reject',requirePermission('inventory:adjust'),async(req,res)=>{
 const parsed=z.object({reason:z.string().trim().min(3).max(1000)}).safeParse(req.body);
 if(!parsed.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:parsed.error.flatten()}});
 const r=await pool.query(`UPDATE stock_variance_correction_requests SET status='REJECTED',approved_by=$1,approved_at=NOW(),
 rejection_reason=$2,updated_at=NOW() WHERE id=$3 AND organisation_id=$4 AND status='PENDING' AND requested_by<>$1 RETURNING *`,
 [req.auth!.userId,parsed.data.reason,req.params.requestId,orgId(req)]);
 if(!r.rowCount)return fail(res,'CORRECTION_NOT_REJECTABLE','Correction is missing, not pending, or self-review was attempted',409);
 res.json({data:r.rows[0]});
});

// P06 procurement and stock receipt; all stock writes are ledger-backed.
operationsRouter.post('/inventory/receipts',requirePermission('inventory:receive'),async(req,res)=>{
 const s=z.object({outletId:uuid,productId:uuid,quantity:z.number().positive(),reference:z.string().max(100).optional(),notes:z.string().max(1000).optional(),unitCost:z.number().min(0).optional()}).safeParse(req.body);
 if(!s.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:s.error.flatten()}});
 const d=s.data, client=await pool.connect();
 try {
  await client.query('BEGIN');
  const key=String(req.get('Idempotency-Key')??'').trim();
  if(!/^[A-Za-z0-9][A-Za-z0-9._:-]{15,120}$/.test(key)){await client.query('ROLLBACK');return fail(res,'IDEMPOTENCY_KEY_REQUIRED','Provide a 16-120 character Idempotency-Key header');}
  const outlet=await client.query('SELECT id FROM outlets WHERE id=$1 AND organisation_id=$2 FOR UPDATE',[d.outletId,orgId(req)]);
  const product=await client.query('SELECT id FROM products WHERE id=$1 AND organisation_id=$2',[d.productId,orgId(req)]);
  if(!outlet.rowCount||!product.rowCount){await client.query('ROLLBACK');return fail(res,'INVALID_STOCK_TARGET','Outlet or product not found',404);}
  const movement=await appendStockMovementOnce(client,{organisationId:orgId(req),outletId:d.outletId,productId:d.productId,movementType:'RECEIPT',quantityUnits:d.quantity,referenceType:'MANUAL_RECEIPT',notes:d.notes??d.reference??null,idempotencyKey:`manual-receipt:${key}`,createdBy:req.auth!.userId});
  const m=await client.query('SELECT * FROM stock_movements WHERE id=$1',[movement.id]);
  if(movement.created) await client.query(`INSERT INTO stock_balances(organisation_id,outlet_id,product_id,quantity_units) VALUES($1,$2,$3,$4)
   ON CONFLICT(outlet_id,product_id) DO UPDATE SET quantity_units=stock_balances.quantity_units+EXCLUDED.quantity_units,updated_at=NOW() WHERE stock_balances.organisation_id=EXCLUDED.organisation_id`,[orgId(req),d.outletId,d.productId,d.quantity]);
  if(movement.created && d.unitCost!==undefined) await addInventoryCostLayer(client,{organisationId:orgId(req),outletId:d.outletId,productId:d.productId,sourceType:'MANUAL_RECEIPT',sourceId:movement.id,sourceLineId:movement.id,quantityUnits:d.quantity,unitCost:d.unitCost});
  if(movement.created && d.unitCost===undefined) await client.query(`INSERT INTO inventory_cost_exceptions(organisation_id,outlet_id,product_id,source_type,source_id,requested_units,covered_units,reason)
   VALUES($1,$2,$3,'MANUAL_RECEIPT',$4,$5,0,'Manual receipt has no supplied unit cost; inventory remains unvalued') ON CONFLICT DO NOTHING`,
   [orgId(req),d.outletId,d.productId,movement.id,d.quantity]);
  const balance=await client.query('SELECT quantity_units FROM stock_balances WHERE organisation_id=$1 AND outlet_id=$2 AND product_id=$3',[orgId(req),d.outletId,d.productId]);
  await client.query('COMMIT'); return res.status(movement.created?201:200).json({data:m.rows[0],balance:balance.rows[0]?.quantity_units,replayed:!movement.created});
 } catch(e){await client.query('ROLLBACK');throw e;} finally{client.release();}
});
operationsRouter.get('/inventory/balances',requirePermission('inventory:read'),async(req,res)=>{
 const outlet=req.query.outletId ? String(req.query.outletId) : null;
 const r=await pool.query(`SELECT b.*,p.sku,p.name,p.pack_size_ml FROM stock_balances b JOIN products p ON p.id=b.product_id AND p.organisation_id=b.organisation_id
 WHERE b.organisation_id=$1 AND ($2::uuid IS NULL OR b.outlet_id=$2) ORDER BY p.name`,[orgId(req),outlet]);res.json({data:r.rows});
});
operationsRouter.post('/inventory/adjustments',requirePermission('inventory:adjust'),async(req,res)=>{
 const s=z.object({outletId:uuid,productId:uuid,delta:z.number().refine(n=>n!==0),reason:z.string().min(3).max(500)}).safeParse(req.body);
 if(!s.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:s.error.flatten()}});
 const d=s.data,client=await pool.connect();
 try{await client.query('BEGIN');
 const key=String(req.get('Idempotency-Key')??'').trim();
 if(!/^[A-Za-z0-9][A-Za-z0-9._:-]{15,120}$/.test(key)){await client.query('ROLLBACK');return fail(res,'IDEMPOTENCY_KEY_REQUIRED','Provide a 16-120 character Idempotency-Key header');}
 const b=await client.query('SELECT quantity_units FROM stock_balances WHERE outlet_id=$1 AND product_id=$2 AND organisation_id=$3 FOR UPDATE',[d.outletId,d.productId,orgId(req)]);
 const current=Number(b.rows[0]?.quantity_units ?? 0);
 const movement=await appendStockMovementOnce(client,{organisationId:orgId(req),outletId:d.outletId,productId:d.productId,movementType:'ADJUSTMENT',quantityUnits:Math.abs(d.delta),adjustmentDirection:d.delta>0?'INCREASE':'DECREASE',referenceType:'MANUAL_ADJUSTMENT',notes:`${d.reason};delta:${d.delta}`,idempotencyKey:`manual-adjustment:${key}`,createdBy:req.auth!.userId});
 const m=await client.query('SELECT * FROM stock_movements WHERE id=$1',[movement.id]);
 if(!movement.created){await client.query('COMMIT');return res.status(200).json({data:m.rows[0],balance:current,replayed:true});}
 const next=current+d.delta;
 if(next<0){await client.query('ROLLBACK');return fail(res,'INSUFFICIENT_STOCK','Adjustment cannot make stock negative',409);}
 await client.query(`INSERT INTO stock_balances(organisation_id,outlet_id,product_id,quantity_units) VALUES($1,$2,$3,$4)
 ON CONFLICT(outlet_id,product_id) DO UPDATE SET quantity_units=EXCLUDED.quantity_units,updated_at=NOW() WHERE stock_balances.organisation_id=EXCLUDED.organisation_id`,[orgId(req),d.outletId,d.productId,next]);
 await client.query('COMMIT');res.status(201).json({data:m.rows[0],balance:next,replayed:false});
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
});

// P518 batch register and expiry visibility. Quantities are tracked per outlet/product/lot.
operationsRouter.get('/inventory/batches',requirePermission('inventory:read'),async(req,res)=>{
 const outlet=req.query.outletId?String(req.query.outletId):null;
 const days=Math.min(365,Math.max(0,Number(req.query.expiringWithinDays??90)||0));
 const r=await pool.query(`SELECT b.*,p.name,p.sku FROM inventory_batches b JOIN products p ON p.id=b.product_id AND p.organisation_id=b.organisation_id
  WHERE b.organisation_id=$1 AND ($2::uuid IS NULL OR b.outlet_id=$2) AND b.remaining_units>0
  AND (b.expiry_date IS NULL OR b.expiry_date<=CURRENT_DATE+$3::int) ORDER BY b.expiry_date NULLS LAST,p.name`,[orgId(req),outlet,days]);res.json({data:r.rows});
});
operationsRouter.post('/inventory/batches',requirePermission('inventory:receive'),async(req,res)=>{
 const s=z.object({outletId:uuid,productId:uuid,batchNumber:z.string().trim().min(1).max(100),quantity:z.number().positive(),unitCost:z.number().min(0).optional(),expiryDate:z.string().date().optional()}).safeParse(req.body);
 if(!s.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:s.error.flatten()}});
 const d=s.data,client=await pool.connect();try{await client.query('BEGIN');
  const o=await client.query('SELECT id FROM outlets WHERE id=$1 AND organisation_id=$2',[d.outletId,orgId(req)]);const p=await client.query("SELECT id FROM products WHERE id=$1 AND organisation_id=$2 AND status='ACTIVE'",[d.productId,orgId(req)]);
  if(!o.rowCount||!p.rowCount){await client.query('ROLLBACK');return fail(res,'INVALID_STOCK_TARGET','Outlet or active product not found',404);}
  const b=await client.query(`INSERT INTO inventory_batches(organisation_id,outlet_id,product_id,batch_number,received_units,remaining_units,expiry_date,created_by)
   VALUES($1,$2,$3,$4,$5,$5,$6,$7) RETURNING *`,[orgId(req),d.outletId,d.productId,d.batchNumber,d.quantity,d.expiryDate??null,req.auth!.userId]);
  await client.query(`INSERT INTO stock_balances(organisation_id,outlet_id,product_id,quantity_units) VALUES($1,$2,$3,$4)
   ON CONFLICT(outlet_id,product_id) DO UPDATE SET quantity_units=stock_balances.quantity_units+EXCLUDED.quantity_units,updated_at=NOW() WHERE stock_balances.organisation_id=EXCLUDED.organisation_id`,[orgId(req),d.outletId,d.productId,d.quantity]);
  const movement=await appendStockMovementOnce(client,{organisationId:orgId(req),outletId:d.outletId,productId:d.productId,movementType:'RECEIPT',quantityUnits:d.quantity,referenceType:'INVENTORY_BATCH',referenceId:b.rows[0].id,idempotencyKey:`inventory-batch:${b.rows[0].id}:receipt`,notes:d.batchNumber,createdBy:req.auth!.userId});
  if(d.unitCost!==undefined) await addInventoryCostLayer(client,{organisationId:orgId(req),outletId:d.outletId,productId:d.productId,sourceType:'INVENTORY_BATCH',sourceId:movement.id,sourceLineId:movement.id,quantityUnits:d.quantity,unitCost:d.unitCost});
  else await client.query(`INSERT INTO inventory_cost_exceptions(organisation_id,outlet_id,product_id,source_type,source_id,requested_units,covered_units,reason)
   VALUES($1,$2,$3,'INVENTORY_BATCH',$4,$5,0,'Batch receipt has no supplied unit cost; inventory remains unvalued') ON CONFLICT DO NOTHING`,
   [orgId(req),d.outletId,d.productId,movement.id,d.quantity]);
  await client.query('COMMIT');return res.status(201).json({data:b.rows[0]});
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
});

// P518 warehouse controls: stock transfers are dispatched and received as separate auditable steps.
operationsRouter.get('/inventory/transfers',requirePermission('inventory:read'),async(req,res)=>{
 const r=await pool.query(`SELECT t.*,so.name AS source_outlet_name,do.name AS destination_outlet_name,
  (SELECT COUNT(*) FROM stock_transfer_lines l WHERE l.transfer_id=t.id) AS line_count
  FROM stock_transfers t JOIN outlets so ON so.id=t.source_outlet_id AND so.organisation_id=t.organisation_id JOIN outlets do ON do.id=t.destination_outlet_id AND do.organisation_id=t.organisation_id
  WHERE t.organisation_id=$1 ORDER BY t.created_at DESC LIMIT 200`,[orgId(req)]);res.json({data:r.rows});
});
operationsRouter.post('/inventory/transfers',requirePermission('inventory:adjust'),async(req,res)=>{
 const s=z.object({transferNumber:z.string().trim().min(2).max(60),sourceOutletId:uuid,destinationOutletId:uuid,notes:z.string().max(1000).optional(),
  lines:z.array(z.object({productId:uuid,quantity:z.number().positive().max(999999).refine(v=>Math.abs(Math.round(v*1000)-v*1000)<1e-7)})).min(1).max(100)}).superRefine((v,ctx)=>{if(v.sourceOutletId===v.destinationOutletId)ctx.addIssue({code:'custom',message:'Source and destination must differ'});if(new Set(v.lines.map(x=>x.productId)).size!==v.lines.length)ctx.addIssue({code:'custom',message:'Each product may appear only once'});}).safeParse(req.body);
 if(!s.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:s.error.flatten()}});
 const d=s.data,client=await pool.connect();try{await client.query('BEGIN');
  const outlets=await client.query('SELECT id FROM outlets WHERE organisation_id=$1 AND id=ANY($2::uuid[]) FOR UPDATE',[orgId(req),[d.sourceOutletId,d.destinationOutletId]]);
  if(outlets.rowCount!==2){await client.query('ROLLBACK');return fail(res,'OUTLET_NOT_FOUND','Both transfer outlets must belong to this organisation',404);}
  const ids=d.lines.map(x=>x.productId),products=await client.query("SELECT id FROM products WHERE organisation_id=$1 AND status='ACTIVE' AND id=ANY($2::uuid[])",[orgId(req),ids]);
  if(products.rowCount!==new Set(ids).size){await client.query('ROLLBACK');return fail(res,'PRODUCT_NOT_FOUND','One or more products are invalid or duplicated',404);}
  const t=await client.query(`INSERT INTO stock_transfers(organisation_id,transfer_number,source_outlet_id,destination_outlet_id,notes,created_by)
   VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[orgId(req),d.transferNumber,d.sourceOutletId,d.destinationOutletId,d.notes??null,req.auth!.userId]);
  for(const l of d.lines)await client.query('INSERT INTO stock_transfer_lines(transfer_id,product_id,requested_units) VALUES($1,$2,$3)',[t.rows[0].id,l.productId,l.quantity]);
  await client.query('COMMIT');return res.status(201).json({data:t.rows[0]});
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
});
operationsRouter.get('/inventory/transfers/:transferId',requirePermission('inventory:read'),async(req,res)=>{
 const t=await pool.query('SELECT * FROM stock_transfers WHERE id=$1 AND organisation_id=$2',[req.params.transferId,orgId(req)]);
 if(!t.rowCount)return fail(res,'TRANSFER_NOT_FOUND','Transfer not found',404);
 const l=await pool.query('SELECT l.*,p.name,p.sku FROM stock_transfer_lines l JOIN stock_transfers t ON t.id=l.transfer_id AND t.organisation_id=$2 JOIN products p ON p.id=l.product_id AND p.organisation_id=t.organisation_id WHERE l.transfer_id=$1 ORDER BY p.name',[req.params.transferId,orgId(req)]);res.json({data:{...t.rows[0],lines:l.rows}});
});
operationsRouter.post('/inventory/transfers/:transferId/dispatch',requirePermission('inventory:adjust'),async(req,res)=>{
 if(Array.isArray(req.params.transferId))return fail(res,'INVALID_TRANSFER_ID','Transfer ID must be a single path value',400);
 const transferId=req.params.transferId;
 const client=await pool.connect();try{await client.query('BEGIN');
  const t=await client.query("SELECT * FROM stock_transfers WHERE id=$1 AND organisation_id=$2 FOR UPDATE",[req.params.transferId,orgId(req)]);
  if(!t.rowCount){await client.query('ROLLBACK');return fail(res,'TRANSFER_NOT_FOUND','Transfer not found',404);}
  if(t.rows[0].status!=='DRAFT'){await client.query('ROLLBACK');return fail(res,'INVALID_TRANSFER_STATE','Only draft transfers can be dispatched',409);}
  const lines=await client.query('SELECT * FROM stock_transfer_lines WHERE transfer_id=$1 ORDER BY product_id FOR UPDATE',[req.params.transferId]);
  for(const l of lines.rows){const b=await client.query('SELECT quantity_units FROM stock_balances WHERE organisation_id=$1 AND outlet_id=$2 AND product_id=$3 FOR UPDATE',[orgId(req),t.rows[0].source_outlet_id,l.product_id]);
   const onHand=Number(b.rows[0]?.quantity_units??0),qty=Number(l.requested_units);if(onHand<qty){await client.query('ROLLBACK');return fail(res,'INSUFFICIENT_STOCK',`Insufficient stock for product ${l.product_id}`,409);}
   await client.query('UPDATE stock_balances SET quantity_units=quantity_units-$1,updated_at=NOW() WHERE organisation_id=$2 AND outlet_id=$3 AND product_id=$4',[qty,orgId(req),t.rows[0].source_outlet_id,l.product_id]);
   await appendStockMovementOnce(client,{organisationId:orgId(req),outletId:t.rows[0].source_outlet_id,productId:l.product_id,movementType:'TRANSFER_OUT',quantityUnits:qty,referenceType:'STOCK_TRANSFER',referenceId:transferId,idempotencyKey:`stock-transfer:${transferId}:line:${l.id}:out`,notes:t.rows[0].transfer_number,createdBy:req.auth!.userId});
   await client.query('UPDATE stock_transfer_lines SET dispatched_units=$1 WHERE id=$2 AND transfer_id IN (SELECT id FROM stock_transfers WHERE id=$3 AND organisation_id=$4)',[qty,l.id,req.params.transferId,orgId(req)]);
  }
  const updated=await client.query("UPDATE stock_transfers SET status='DISPATCHED',dispatched_by=$1,dispatched_at=NOW() WHERE id=$2 AND organisation_id=$3 RETURNING *",[req.auth!.userId,req.params.transferId,orgId(req)]);
  await client.query('COMMIT');return res.json({data:updated.rows[0]});
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
});
operationsRouter.post('/inventory/transfers/:transferId/receive',requirePermission('inventory:receive'),async(req,res)=>{
 if(Array.isArray(req.params.transferId))return fail(res,'INVALID_TRANSFER_ID','Transfer ID must be a single path value',400);
 const transferId=req.params.transferId;
 const s=z.object({lines:z.array(z.object({productId:uuid,receivedQuantity:z.number().min(0).max(999999).refine(v=>Math.abs(Math.round(v*1000)-v*1000)<1e-7),varianceReason:z.string().max(500).optional()})).min(1).max(100)}).superRefine((v,ctx)=>{if(new Set(v.lines.map(x=>x.productId)).size!==v.lines.length)ctx.addIssue({code:'custom',message:'Each product may appear only once'});}).safeParse(req.body);
 if(!s.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:s.error.flatten()}});
 const client=await pool.connect();try{await client.query('BEGIN');
  const t=await client.query("SELECT * FROM stock_transfers WHERE id=$1 AND organisation_id=$2 FOR UPDATE",[req.params.transferId,orgId(req)]);
  if(!t.rowCount){await client.query('ROLLBACK');return fail(res,'TRANSFER_NOT_FOUND','Transfer not found',404);}
  if(t.rows[0].status!=='DISPATCHED'){await client.query('ROLLBACK');return fail(res,'INVALID_TRANSFER_STATE','Only dispatched transfers can be received',409);}
  const lines=await client.query('SELECT * FROM stock_transfer_lines WHERE transfer_id=$1 ORDER BY product_id FOR UPDATE',[req.params.transferId]);
  if(s.data.lines.length!==lines.rowCount||s.data.lines.some(x=>!lines.rows.some((l:any)=>l.product_id===x.productId))){await client.query('ROLLBACK');return fail(res,'TRANSFER_LINES_MISMATCH','Receive quantities must cover every transfer line exactly once');}
  for(const l of lines.rows){const input=s.data.lines.find(x=>x.productId===l.product_id)!;const dispatched=Number(l.dispatched_units);if(input.receivedQuantity>dispatched){await client.query('ROLLBACK');return fail(res,'RECEIVED_EXCEEDS_DISPATCHED','Received quantity cannot exceed dispatched quantity');}
   await client.query(`INSERT INTO stock_balances(organisation_id,outlet_id,product_id,quantity_units) VALUES($1,$2,$3,$4) ON CONFLICT(outlet_id,product_id) DO UPDATE SET quantity_units=stock_balances.quantity_units+EXCLUDED.quantity_units,updated_at=NOW() WHERE stock_balances.organisation_id=EXCLUDED.organisation_id`,[orgId(req),t.rows[0].destination_outlet_id,l.product_id,input.receivedQuantity]);
   if(input.receivedQuantity>0)await appendStockMovementOnce(client,{organisationId:orgId(req),outletId:t.rows[0].destination_outlet_id,productId:l.product_id,movementType:'TRANSFER_IN',quantityUnits:input.receivedQuantity,referenceType:'STOCK_TRANSFER',referenceId:t.rows[0].id,idempotencyKey:`stock-transfer:${transferId}:line:${l.id}:in`,notes:t.rows[0].transfer_number,createdBy:req.auth!.userId});
   const variance=dispatched-input.receivedQuantity;if(variance>0&&!input.varianceReason?.trim()){await client.query('ROLLBACK');return fail(res,'VARIANCE_REASON_REQUIRED','A reason is required for every transfer shortage');}
   await client.query('UPDATE stock_transfer_lines SET received_units=$1,variance_reason=$2 WHERE id=$3 AND transfer_id IN (SELECT id FROM stock_transfers WHERE id=$4 AND organisation_id=$5)',[input.receivedQuantity,input.varianceReason??null,l.id,req.params.transferId,orgId(req)]);
  }
  const updated=await client.query("UPDATE stock_transfers SET status='RECEIVED',received_by=$1,received_at=NOW() WHERE id=$2 AND organisation_id=$3 RETURNING *",[req.auth!.userId,req.params.transferId,orgId(req)]);
  await client.query('COMMIT');return res.json({data:updated.rows[0]});
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
});
operationsRouter.get('/inventory/stocktakes',requirePermission('inventory:read'),async(req,res)=>{
 const r=await pool.query('SELECT * FROM inventory_stocktakes WHERE organisation_id=$1 ORDER BY created_at DESC LIMIT 200',[orgId(req)]);res.json({data:r.rows});
});
operationsRouter.post('/inventory/stocktakes',requirePermission('inventory:adjust'),async(req,res)=>{
 const s=z.object({outletId:uuid,notes:z.string().max(1000).optional()}).safeParse(req.body);if(!s.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:s.error.flatten()}});
 const client=await pool.connect();try{await client.query('BEGIN');const o=await client.query('SELECT id FROM outlets WHERE id=$1 AND organisation_id=$2 FOR UPDATE',[s.data.outletId,orgId(req)]);if(!o.rowCount){await client.query('ROLLBACK');return fail(res,'OUTLET_NOT_FOUND','Outlet not found',404);}
  const c=await client.query("INSERT INTO inventory_stocktakes(organisation_id,outlet_id,notes,counted_by) VALUES($1,$2,$3,$4) RETURNING *",[orgId(req),s.data.outletId,s.data.notes??null,req.auth!.userId]);
  const b=await client.query(`SELECT p.id AS product_id,COALESCE(sb.quantity_units,0) AS quantity_units FROM products p LEFT JOIN stock_balances sb ON sb.product_id=p.id AND sb.outlet_id=$2 AND sb.organisation_id=$1 WHERE p.organisation_id=$1 AND p.status='ACTIVE' ORDER BY p.id`,[orgId(req),s.data.outletId]);
  for(const x of b.rows)await client.query('INSERT INTO inventory_stocktake_lines(stocktake_id,product_id,expected_units,counted_units) VALUES($1,$2,$3,$3)',[c.rows[0].id,x.product_id,x.quantity_units]);
  await client.query('COMMIT');return res.status(201).json({data:c.rows[0],lineCount:b.rowCount});
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
});
operationsRouter.get('/inventory/stocktakes/:stocktakeId',requirePermission('inventory:read'),async(req,res)=>{
 const c=await pool.query('SELECT * FROM inventory_stocktakes WHERE id=$1 AND organisation_id=$2',[req.params.stocktakeId,orgId(req)]);if(!c.rowCount)return fail(res,'STOCKTAKE_NOT_FOUND','Stocktake not found',404);
 const l=await pool.query('SELECT l.*,p.name,p.sku FROM inventory_stocktake_lines l JOIN products p ON p.id=l.product_id WHERE l.stocktake_id=$1 ORDER BY p.name',[req.params.stocktakeId]);res.json({data:{...c.rows[0],lines:l.rows}});
});
operationsRouter.put('/inventory/stocktakes/:stocktakeId/lines/:productId',requirePermission('inventory:adjust'),async(req,res)=>{
 const s=z.object({countedUnits:z.number().min(0).max(999999).refine(v=>Math.abs(Math.round(v*1000)-v*1000)<1e-7)}).safeParse(req.body);if(!s.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:s.error.flatten()}});
 const r=await pool.query(`UPDATE inventory_stocktake_lines l SET counted_units=$1 FROM inventory_stocktakes c WHERE l.stocktake_id=c.id AND c.id=$2 AND c.organisation_id=$3 AND c.status='COUNTING' AND l.product_id=$4 RETURNING l.*`,[s.data.countedUnits,req.params.stocktakeId,orgId(req),req.params.productId]);if(!r.rowCount)return fail(res,'STOCKTAKE_LINE_NOT_EDITABLE','Stocktake or line not found, or counting is closed',409);res.json({data:r.rows[0]});
});
operationsRouter.post('/inventory/stocktakes/:stocktakeId/submit',requirePermission('inventory:adjust'),async(req,res)=>{
 const r=await pool.query("UPDATE inventory_stocktakes SET status='SUBMITTED',submitted_at=NOW() WHERE id=$1 AND organisation_id=$2 AND status='COUNTING' RETURNING *",[req.params.stocktakeId,orgId(req)]);if(!r.rowCount)return fail(res,'STOCKTAKE_NOT_SUBMITTABLE','Only an open count can be submitted',409);res.json({data:r.rows[0]});
});
operationsRouter.post('/inventory/stocktakes/:stocktakeId/approve',requirePermission('inventory:adjust'),async(req,res)=>{
 if(Array.isArray(req.params.stocktakeId))return fail(res,'INVALID_STOCKTAKE_ID','Stocktake ID must be a single path value',400);
 const stocktakeId=req.params.stocktakeId;
 const s=z.object({reason:z.string().trim().min(3).max(500)}).safeParse(req.body);if(!s.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:s.error.flatten()}});
 const client=await pool.connect();try{await client.query('BEGIN');const c=await client.query("SELECT * FROM inventory_stocktakes WHERE id=$1 AND organisation_id=$2 FOR UPDATE",[req.params.stocktakeId,orgId(req)]);if(!c.rowCount){await client.query('ROLLBACK');return fail(res,'STOCKTAKE_NOT_FOUND','Stocktake not found',404);}if(c.rows[0].status!=='SUBMITTED'){await client.query('ROLLBACK');return fail(res,'INVALID_STOCKTAKE_STATE','Only submitted stocktakes can be approved',409);}
  const lines=await client.query('SELECT * FROM inventory_stocktake_lines WHERE stocktake_id=$1 ORDER BY product_id FOR UPDATE',[req.params.stocktakeId]);
  for(const l of lines.rows){const delta=Number(l.counted_units)-Number(l.expected_units);if(!delta)continue;const b=await client.query('SELECT quantity_units FROM stock_balances WHERE organisation_id=$1 AND outlet_id=$2 AND product_id=$3 FOR UPDATE',[orgId(req),c.rows[0].outlet_id,l.product_id]);const current=Number(b.rows[0]?.quantity_units??0);if(Math.abs(current-Number(l.expected_units))>0.0005){await client.query('ROLLBACK');return fail(res,'STOCK_CHANGED_DURING_COUNT','Stock changed after the count snapshot; create a fresh stocktake before approval',409);}if(current+delta<0){await client.query('ROLLBACK');return fail(res,'INVALID_STOCKTAKE_VARIANCE','Stocktake adjustment would create negative stock',409);}
   await client.query(`INSERT INTO stock_balances(organisation_id,outlet_id,product_id,quantity_units) VALUES($1,$2,$3,$4) ON CONFLICT(outlet_id,product_id) DO UPDATE SET quantity_units=EXCLUDED.quantity_units,updated_at=NOW() WHERE stock_balances.organisation_id=EXCLUDED.organisation_id`,[orgId(req),c.rows[0].outlet_id,l.product_id,Number(l.counted_units)]);
   await appendStockMovementOnce(client,{organisationId:orgId(req),outletId:c.rows[0].outlet_id,productId:l.product_id,movementType:'ADJUSTMENT',quantityUnits:Math.abs(delta),adjustmentDirection:delta>0?'INCREASE':'DECREASE',referenceType:'STOCKTAKE',referenceId:stocktakeId,idempotencyKey:`stocktake:${stocktakeId}:line:${l.id}`,notes:s.data.reason,createdBy:req.auth!.userId});
  }
  const updated=await client.query("UPDATE inventory_stocktakes SET status='APPROVED',approved_by=$1,approved_at=NOW() WHERE id=$2 RETURNING *",[req.auth!.userId,req.params.stocktakeId]);await client.query('COMMIT');return res.json({data:updated.rows[0],adjustedLines:lines.rows.filter((l:any)=>Number(l.counted_units)!==Number(l.expected_units)).length});
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
});

// Outlet/channel prices are authored by an authorised manager and resolved server-side at checkout.
operationsRouter.post('/outlets/:outletId/prices',requirePermission('catalogue:manage'),async(req,res)=>{
 const schema=z.object({
  productId:uuid,
  channel:z.enum(['RETAIL','BAR_BOTTLE','BAR_PACKAGED','BAR_PEG']),
  volumeMl:z.number().int().positive().optional(),
  unitPrice:z.number().nonnegative(),
  taxRate:z.number().min(0).max(100).default(0)
 }).superRefine((v,ctx)=>{
  if(v.channel==='BAR_PEG'&&!v.volumeMl)ctx.addIssue({code:'custom',message:'Peg price requires volumeMl',path:['volumeMl']});
  if(v.channel!=='BAR_PEG'&&v.volumeMl)ctx.addIssue({code:'custom',message:'volumeMl is only valid for BAR_PEG',path:['volumeMl']});
 }).safeParse(req.body);
 if(!schema.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:schema.error.flatten()}});
 const d=schema.data,client=await pool.connect();
 try{
  await client.query('BEGIN');
  const outlet=await client.query('SELECT id FROM outlets WHERE id=$1 AND organisation_id=$2 FOR UPDATE',[req.params.outletId,orgId(req)]);
  const product=await client.query("SELECT id FROM products WHERE id=$1 AND organisation_id=$2 AND status='ACTIVE'",[d.productId,orgId(req)]);
  if(!outlet.rowCount||!product.rowCount){await client.query('ROLLBACK');return fail(res,'PRICE_TARGET_NOT_FOUND','Outlet or active product not found',404);}
  await client.query(`UPDATE outlet_product_prices SET effective_until=NOW()
   WHERE outlet_id=$1 AND product_id=$2 AND channel=$3 AND COALESCE(volume_ml,0)=COALESCE($4,0) AND effective_until IS NULL`,
   [req.params.outletId,d.productId,d.channel,d.volumeMl??null]);
  const inserted=await client.query(`INSERT INTO outlet_product_prices(organisation_id,outlet_id,product_id,channel,volume_ml,unit_price,tax_rate,created_by)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
   [orgId(req),req.params.outletId,d.productId,d.channel,d.volumeMl??null,d.unitPrice,d.taxRate,req.auth!.userId]);
  await client.query('COMMIT');return res.status(201).json({data:inserted.rows[0]});
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
});
operationsRouter.get('/outlets/:outletId/prices',requirePermission('catalogue:read'),async(req,res)=>{
 const channel=String(req.query.channel??'');
 if(channel&&!['RETAIL','BAR_BOTTLE','BAR_PACKAGED','BAR_PEG'].includes(channel))return fail(res,'INVALID_CHANNEL','Unsupported price channel');
 const result=await pool.query(`SELECT pr.*,p.sku,p.name,p.barcode,p.pack_size_ml
  FROM outlet_product_prices pr JOIN products p ON p.id=pr.product_id
  WHERE pr.organisation_id=$1 AND pr.outlet_id=$2
    AND ($3='' OR pr.channel=$3)
    AND pr.effective_from<=NOW() AND (pr.effective_until IS NULL OR pr.effective_until>NOW())
  ORDER BY p.name,pr.channel,pr.volume_ml`,[orgId(req),req.params.outletId,channel]);
 return res.json({data:result.rows});
});

// P07 retail checkout: idempotency key + row locks + stock ledger.
operationsRouter.post('/retail/sales',requirePermission('retail:sell'),async(req,res)=>{
 const s=z.object({
  outletId:uuid,
  idempotencyKey:z.string().trim().min(8).max(100),
  receiptNumber:z.string().trim().min(1).max(60),
  lines:z.array(z.object({
   productId:uuid,
   quantity:z.number().positive().max(999999).refine((value)=>Math.abs(Math.round(value*1000)-value*1000)<1e-7,'Quantity supports at most three decimal places'),
   // Client prices are deliberately ignored; all amounts are resolved from the active server price book.
   unitPrice:z.number().nonnegative().optional(),
   taxAmount:z.number().nonnegative().optional()
  })).min(1).max(100),
  payments:z.array(z.object({
   method:z.enum(['CASH','UPI','CARD','WALLET','OTHER']),
   amount:z.number().positive().max(999999999).refine((value)=>Math.abs(Math.round(value*100)-value*100)<1e-7,'Payment amount supports at most two decimal places'),
   reference:z.string().max(160).optional()
  })).min(1).max(10),
  complianceAttestations:z.object({ageVerified:z.literal(true),notIntoxicated:z.literal(true),noRestrictedCustomer:z.literal(true),consumptionOnPremises:z.literal(false)})
 }).safeParse(req.body);
 if(!s.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:s.error.flatten()}});
 const d=s.data,organisationId=orgId(req);
 const fingerprint=createRetailCheckoutFingerprint(d);
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  const access=await checkOutletOperationalAccess(client,organisationId,d.outletId,'RETAIL_SALE',{userId:req.auth!.userId,roleCode:req.auth!.roleCode});
  if(!access.allowed){await client.query('ROLLBACK');return fail(res,access.code,access.message,403);}

  const existing=await client.query(
   'SELECT * FROM retail_sales WHERE organisation_id=$1 AND outlet_id=$2 AND idempotency_key=$3 FOR UPDATE',
   [organisationId,d.outletId,d.idempotencyKey]
  );
  if(existing.rowCount){
   const lines=await client.query('SELECT * FROM retail_sale_lines WHERE sale_id=$1 ORDER BY id',[existing.rows[0].id]);
   const payments=await client.query('SELECT method,amount,reference FROM sale_payments WHERE sale_id=$1 ORDER BY created_at,id',[existing.rows[0].id]);
   const storedFingerprint=existing.rows[0].request_fingerprint?.trim() || createRetailCheckoutFingerprint({
    outletId:d.outletId,
    receiptNumber:existing.rows[0].receipt_number,
    lines:lines.rows.map((line:any)=>({productId:line.product_id,quantity:Number(line.quantity_units)})),
    payments:payments.rows.map((payment:any)=>({method:payment.method,amount:Number(payment.amount),reference:payment.reference??undefined}))
   });
   if(storedFingerprint!==fingerprint){
    await client.query('ROLLBACK');
    return fail(res,'IDEMPOTENCY_KEY_REUSED','This idempotency key was already used for a different checkout request',409);
   }
   if(!existing.rows[0].request_fingerprint){
    await client.query('UPDATE retail_sales SET request_fingerprint=$1 WHERE id=$2',[fingerprint,existing.rows[0].id]);
   }
   await client.query('COMMIT');
   return res.json({data:existing.rows[0],lines:lines.rows,payments:payments.rows,idempotentReplay:true});
  }

  const outlet=await client.query(
   "SELECT id FROM outlets WHERE id=$1 AND organisation_id=$2 AND status='ACTIVE' FOR UPDATE",
   [d.outletId,organisationId]
  );
  if(!outlet.rowCount){await client.query('ROLLBACK');return fail(res,'OUTLET_NOT_ACTIVE','Outlet not found or not active',409);}

  const compliance = await evaluateExciseSale(client, { organisationId, outletId: d.outletId, channel: 'RETAIL', attestations: d.complianceAttestations, sourceType: 'ONLINE_RETAIL', sourceReference: d.idempotencyKey, actorUserId: req.auth!.userId });
  if (!compliance.allowed) {
   await client.query('COMMIT');
   return fail(res,'EXCISE_COMPLIANCE_BLOCKED',`Retail sale blocked by current excise rules: ${compliance.reasonCodes.join(', ')}`,409);
  }

  let subtotalMinor=0,taxMinor=0;
  const checked:Array<{productId:string;quantity:number;unitPrice:number;taxAmount:number;lineTotal:number;taxSnapshotId:string;taxSnapshotHash:string}>=[];
  for(const line of d.lines){
   const product=await client.query(
    "SELECT id FROM products WHERE id=$1 AND organisation_id=$2 AND status='ACTIVE' FOR UPDATE",
    [line.productId,organisationId]
   );
   if(!product.rowCount){await client.query('ROLLBACK');return fail(res,'PRODUCT_NOT_FOUND','Active product not found',404);}

   const stockRow=await client.query(
    'SELECT quantity_units FROM stock_balances WHERE organisation_id=$1 AND outlet_id=$2 AND product_id=$3 FOR UPDATE',
    [organisationId,d.outletId,line.productId]
   );
   const available=Number(stockRow.rows[0]?.quantity_units??0);
   const alreadyReserved=checked.filter((item)=>item.productId===line.productId).reduce((sum,item)=>sum+item.quantity,0);
   if(!stockRow.rowCount||available-alreadyReserved+1e-9<line.quantity){
    await client.query('ROLLBACK');return fail(res,'INSUFFICIENT_STOCK',`Insufficient stock for product ${line.productId}`,409);
   }

   const quote=await createCheckoutTaxQuote(client,{organisationId,outletId:d.outletId,productId:line.productId,
    actorUserId:req.auth!.userId,channel:'RETAIL',quantity:line.quantity});
   const lineBaseMinor=Math.round(quote.baseAmount*100);
   const lineTaxMinor=Math.round(quote.taxAmount*100);
   subtotalMinor+=lineBaseMinor;taxMinor+=lineTaxMinor;
   checked.push({productId:line.productId,quantity:line.quantity,unitPrice:quote.unitPrice,taxAmount:quote.taxAmount,
    lineTotal:quote.lineTotal,taxSnapshotId:quote.snapshotId,taxSnapshotHash:quote.snapshotHash});
  }

  const grandMinor=subtotalMinor+taxMinor;
  const paidMinor=calculateRetailPaymentTotal(d.payments);
  if(paidMinor!==grandMinor){
   await client.query('ROLLBACK');
   return fail(res,'PAYMENT_TOTAL_MISMATCH','Payment total must exactly equal the server-calculated sale total');
  }

  const subtotal=subtotalMinor/100,tax=taxMinor/100,grand=grandMinor/100;
  const sale=await client.query(
   `INSERT INTO retail_sales(organisation_id,outlet_id,receipt_number,subtotal,tax_total,grand_total,idempotency_key,request_fingerprint,cashier_id)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
   [organisationId,d.outletId,d.receiptNumber,subtotal,tax,grand,d.idempotencyKey,fingerprint,req.auth!.userId]
  );
  await client.query('UPDATE retail_sales SET excise_decision_id=$1 WHERE id=$2', [compliance.decisionId, sale.rows[0].id]);
  for(let lineIndex=0;lineIndex<checked.length;lineIndex++){ const line=checked[lineIndex];
   await client.query(
    'INSERT INTO retail_sale_lines(sale_id,product_id,quantity_units,unit_price,tax_amount,line_total,tax_snapshot_id) VALUES($1,$2,$3,$4,$5,$6,$7)',
    [sale.rows[0].id,line.productId,line.quantity,line.unitPrice,line.taxAmount,line.lineTotal,line.taxSnapshotId]
   );
   const updated=await client.query(
    `UPDATE stock_balances SET quantity_units=quantity_units-$1,updated_at=NOW()
      WHERE organisation_id=$2 AND outlet_id=$3 AND product_id=$4 AND quantity_units >= $1`,
    [line.quantity,organisationId,d.outletId,line.productId]
   );
   if(!updated.rowCount)throw Object.assign(new Error('Stock changed while checkout was being committed'),{code:'RETAIL_STOCK_RACE'});
   const saleMovement=await appendStockMovementOnce(client,{organisationId,outletId:d.outletId,productId:line.productId,movementType:'SALE',quantityUnits:line.quantity,referenceType:'RETAIL_SALE',referenceId:sale.rows[0].id,idempotencyKey:`retail-sale:${sale.rows[0].id}:line:${lineIndex}`,createdBy:req.auth!.userId});
   await consumeInventoryCostFifo(client,{organisationId,outletId:d.outletId,productId:line.productId,quantityUnits:line.quantity,sourceType:'RETAIL_SALE_LINE',sourceId:saleMovement.id,movementId:saleMovement.id});
  }
  for(const payment of d.payments){
   await client.query(
    'INSERT INTO sale_payments(organisation_id,sale_id,method,amount,reference) VALUES($1,$2,$3,$4,$5)',
    [organisationId,sale.rows[0].id,payment.method,Math.round(payment.amount*100)/100,payment.reference??null]
   );
  }
  await client.query(
   `INSERT INTO audit_events(organisation_id,outlet_id,actor_user_id,event_type,entity_type,entity_id,metadata)
    VALUES($1,$2,$3,'RETAIL_CHECKOUT_COMPLETED','RETAIL_SALE',$4,$5)`,
   [organisationId,d.outletId,req.auth!.userId,sale.rows[0].id,{subtotal,tax,grandTotal:grand,lineCount:checked.length,paymentCount:d.payments.length}]
  );
  await client.query('COMMIT');
  return res.status(201).json({data:sale.rows[0],lines:checked,totals:{subtotal,tax,grandTotal:grand},idempotentReplay:false});
 }catch(error:any){
  await client.query('ROLLBACK');
  if(error?.code==='23505'){
   const replay=await pool.query(
    'SELECT * FROM retail_sales WHERE organisation_id=$1 AND outlet_id=$2 AND idempotency_key=$3',
    [organisationId,d.outletId,d.idempotencyKey]
   );
   if(replay.rowCount){
    const [lines,payments]=await Promise.all([
     pool.query('SELECT product_id,quantity_units FROM retail_sale_lines WHERE sale_id=$1 ORDER BY id',[replay.rows[0].id]),
     pool.query('SELECT method,amount,reference FROM sale_payments WHERE sale_id=$1 ORDER BY created_at,id',[replay.rows[0].id])
    ]);
    const storedFingerprint=replay.rows[0].request_fingerprint?.trim() || createRetailCheckoutFingerprint({
     outletId:d.outletId,receiptNumber:replay.rows[0].receipt_number,
     lines:lines.rows.map((line:any)=>({productId:line.product_id,quantity:Number(line.quantity_units)})),
     payments:payments.rows.map((payment:any)=>({method:payment.method,amount:Number(payment.amount),reference:payment.reference??undefined}))
    });
    if(storedFingerprint!==fingerprint)
     return fail(res,'IDEMPOTENCY_KEY_REUSED','This idempotency key was already used for a different checkout request',409);
    if(!replay.rows[0].request_fingerprint)await pool.query('UPDATE retail_sales SET request_fingerprint=$1 WHERE id=$2',[fingerprint,replay.rows[0].id]);
    return res.json({data:replay.rows[0],lines:lines.rows,payments:payments.rows,idempotentReplay:true});
   }
   return fail(res,'RECEIPT_NUMBER_CONFLICT','Receipt number is already in use for this outlet',409);
  }
  if(error?.code==='RETAIL_STOCK_RACE')return fail(res,'INSUFFICIENT_STOCK','Stock changed during checkout; refresh inventory and retry',409);
  if(error?.code==='TAX_CONFIGURATION_INCOMPLETE')return fail(res,'TAX_CONFIGURATION_INCOMPLETE','An active tax pack, verified product profile and approved outlet price are required before checkout',409);
  if(error instanceof Error&&['INVALID_TAX_INPUT','MRP_EXCEEDED','BAR_MENU_CEILING_REQUIRED','MENU_CEILING_EXCEEDED','ALCOHOL_GST_DOUBLE_CHARGE','GST_COMPONENT_CONFLICT','GST_PAIR_INCOMPLETE'].includes(error.message))return fail(res,error.message,'Tax calculation rejected this checkout line',422);
  throw error;
 }finally{client.release();}
});
operationsRouter.get('/retail/sales',requirePermission('retail:read'),async(req,res)=>{
 const outletFilter=typeof req.query.outletId==='string'?req.query.outletId:null;
 if(outletFilter&&!z.string().uuid().safeParse(outletFilter).success)return fail(res,'INVALID_OUTLET_ID','outletId must be a UUID');
 const requestedLimit=Number(req.query.limit??50);
 const limit=Number.isFinite(requestedLimit)?Math.min(Math.max(Math.floor(requestedLimit),1),200):50;
 const r=await pool.query(
  `SELECT s.*,COALESCE((SELECT SUM(r.amount) FROM retail_refunds r WHERE r.sale_id=s.id),0) refunded_total
    FROM retail_sales s WHERE s.organisation_id=$1 AND ($2::uuid IS NULL OR s.outlet_id=$2)
    ORDER BY s.sold_at DESC LIMIT $3`,
  [orgId(req),outletFilter,limit]
 );
 return res.json({data:r.rows});
});
operationsRouter.get('/retail/sales/:saleId',requirePermission('retail:read'),async(req,res)=>{
 const sale=await pool.query('SELECT * FROM retail_sales WHERE id=$1 AND organisation_id=$2',[req.params.saleId,orgId(req)]);
 if(!sale.rowCount)return fail(res,'SALE_NOT_FOUND','Sale not found',404);
 const [lines,payments,refunds]=await Promise.all([
  pool.query(`SELECT l.*,COALESCE((SELECT SUM(x.quantity) FROM retail_refund_restock_lines x WHERE x.sale_line_id=l.id),0) restocked_quantity FROM retail_sale_lines l WHERE l.sale_id=$1 ORDER BY l.id`,[req.params.saleId]),
  pool.query('SELECT * FROM sale_payments WHERE sale_id=$1 ORDER BY created_at,id',[req.params.saleId]),
  pool.query('SELECT * FROM retail_refunds WHERE sale_id=$1 ORDER BY created_at,id',[req.params.saleId])
 ]);
 return res.json({data:{...sale.rows[0],lines:lines.rows,payments:payments.rows,refunds:refunds.rows}});
});

// P08 peg inventory: open bottle, record pour and deduct exact ml under lock.
operationsRouter.post('/bar/open-bottles',requirePermission('peg:manage'),async(req,res)=>{
 const s=z.object({outletId:uuid,productId:uuid,bottleVolumeMl:z.number().int().positive()}).safeParse(req.body);
 if(!s.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:s.error.flatten()}});
 const d=s.data;
 const product=await pool.query('SELECT pack_size_ml FROM products WHERE id=$1 AND organisation_id=$2',[d.productId,orgId(req)]);
 if(!product.rowCount)return fail(res,'PRODUCT_NOT_FOUND','Product not found',404);
 if(d.bottleVolumeMl!==product.rows[0].pack_size_ml)return fail(res,'PACK_SIZE_MISMATCH','Bottle volume must match the configured product pack size');
 const client=await pool.connect();
 try{await client.query('BEGIN');
 const access=await checkOutletOperationalAccess(client,orgId(req),d.outletId,'BAR_SERVICE',{userId:req.auth!.userId,roleCode:req.auth!.roleCode});
 if(!access.allowed){await client.query('ROLLBACK');return fail(res,access.code,access.message,403);}
 const key=String(req.get('Idempotency-Key')??'').trim();
 if(!/^[A-Za-z0-9][A-Za-z0-9._:-]{15,120}$/.test(key)){await client.query('ROLLBACK');return fail(res,'IDEMPOTENCY_KEY_REQUIRED','Provide a 16-120 character Idempotency-Key header');}
 const movement=await appendStockMovementOnce(client,{organisationId:orgId(req),outletId:d.outletId,productId:d.productId,movementType:'TRANSFER_OUT',quantityUnits:1,referenceType:'OPEN_BOTTLE',idempotencyKey:`open-bottle:${key}`,notes:`volume:${d.bottleVolumeMl}`,createdBy:req.auth!.userId});
 if(!movement.created){const prior=await client.query('SELECT * FROM open_bottles WHERE source_movement_id=$1',[movement.id]);if(!prior.rowCount){await client.query('ROLLBACK');return fail(res,'OPEN_BOTTLE_REPLAY_INCONSISTENT','Existing movement has no bottle record',409);}await client.query('COMMIT');return res.status(200).json({data:prior.rows[0],replayed:true});}
 const b=await client.query('SELECT quantity_units FROM stock_balances WHERE outlet_id=$1 AND product_id=$2 AND organisation_id=$3 FOR UPDATE',[d.outletId,d.productId,orgId(req)]);
 if(!b.rowCount||Number(b.rows[0].quantity_units)<1){await client.query('ROLLBACK');return fail(res,'INSUFFICIENT_STOCK','No full bottle available',409);}
 await client.query('UPDATE stock_balances SET quantity_units=quantity_units-1,updated_at=NOW() WHERE outlet_id=$1 AND product_id=$2',[d.outletId,d.productId]);
 const bottle=await client.query(`INSERT INTO open_bottles(organisation_id,outlet_id,product_id,source_movement_id,bottle_volume_ml,remaining_ml,opened_by)
 VALUES($1,$2,$3,$4,$5,$5,$6) RETURNING *`,[orgId(req),d.outletId,d.productId,movement.id,d.bottleVolumeMl,req.auth!.userId]);
 await client.query('COMMIT');res.status(201).json({data:bottle.rows[0],replayed:false});
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
});
operationsRouter.post('/bar/peg-transactions',requirePermission('peg:sell'),async(req,res)=>{
 const s=z.object({outletId:uuid,openBottleId:uuid,volumeMl:z.number().int().positive(),type:z.enum(['WASTAGE','COMPLIMENTARY','ADJUSTMENT','BREAKAGE']),referenceId:uuid.optional(),notes:z.string().max(1000).optional()}).safeParse(req.body);
 if(!s.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:s.error.flatten()}});
 const d=s.data,client=await pool.connect();
 try{await client.query('BEGIN');
 const access=await checkOutletOperationalAccess(client,orgId(req),d.outletId,'BAR_SERVICE',{userId:req.auth!.userId,roleCode:req.auth!.roleCode});
 if(!access.allowed){await client.query('ROLLBACK');return fail(res,access.code,access.message,403);}
 const b=await client.query('SELECT * FROM open_bottles WHERE id=$1 AND outlet_id=$2 AND organisation_id=$3 FOR UPDATE',[d.openBottleId,d.outletId,orgId(req)]);
 if(!b.rowCount){await client.query('ROLLBACK');return fail(res,'OPEN_BOTTLE_NOT_FOUND','Open bottle not found',404);}
 const reserved=await client.query("SELECT COALESCE(SUM(reserved_ml-consumed_ml),0)::int amount FROM bar_bottle_reservations WHERE open_bottle_id=$1 AND status='ACTIVE' AND expires_at>NOW()",[d.openBottleId]);
 const unreserved=Number(b.rows[0].remaining_ml)-Number(reserved.rows[0].amount);
 if(unreserved<d.volumeMl){await client.query('ROLLBACK');return res.status(409).json({error:{code:'INSUFFICIENT_UNRESERVED_ML',message:'Release active bottle reservations before recording this volume deduction',availableMl:Math.max(0,unreserved)}});}
 const left=Number(b.rows[0].remaining_ml)-d.volumeMl;
 await client.query('UPDATE open_bottles SET remaining_ml=$1,status=$2,closed_at=CASE WHEN $2=\'EMPTY\' THEN NOW() ELSE closed_at END WHERE id=$3',[left,left===0?'EMPTY':'OPEN',d.openBottleId]);
 const tx=await client.query(`INSERT INTO peg_transactions(organisation_id,outlet_id,open_bottle_id,product_id,volume_ml,transaction_type,reference_id,notes,performed_by)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[orgId(req),d.outletId,d.openBottleId,b.rows[0].product_id,d.volumeMl,d.type,d.referenceId ?? null,d.notes ?? null,req.auth!.userId]);
 await client.query('COMMIT');res.status(201).json({data:tx.rows[0],remainingMl:left});
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
});
operationsRouter.get('/bar/open-bottles',requirePermission('peg:read'),async(req,res)=>{
 const r=await pool.query(`SELECT b.*,p.name,p.sku,
   GREATEST(0,b.remaining_ml-COALESCE((SELECT SUM(r.reserved_ml-r.consumed_ml) FROM bar_bottle_reservations r WHERE r.open_bottle_id=b.id AND r.status='ACTIVE' AND r.expires_at>NOW()),0)) available_ml
   FROM open_bottles b JOIN products p ON p.id=b.product_id
   WHERE b.organisation_id=$1 AND b.outlet_id=$2 AND b.status='OPEN' ORDER BY b.opened_at`,[orgId(req),String(req.query.outletId ?? '')]);res.json({data:r.rows});
});

// P531: reserve a measured quantity on a specific open bottle for a bounded service window.
operationsRouter.post('/bar/open-bottles/:bottleId/reservations',requirePermission('peg:manage'),async(req,res)=>{
 const s=z.object({outletId:uuid,volumeMl:z.number().int().positive(),expiresAt:z.string().datetime(),reason:z.string().trim().min(3).max(500)}).safeParse(req.body);
 if(!s.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:s.error.flatten()}});
 const d=s.data,expiry=new Date(d.expiresAt),now=new Date();
 if(expiry<=now||expiry.getTime()-now.getTime()>24*60*60*1000)return fail(res,'INVALID_RESERVATION_EXPIRY','Reservation expiry must be within the next 24 hours');
 const client=await pool.connect();
 try{await client.query('BEGIN');
  const access=await checkOutletOperationalAccess(client,orgId(req),d.outletId,'BAR_SERVICE',{userId:req.auth!.userId,roleCode:req.auth!.roleCode});
  if(!access.allowed){await client.query('ROLLBACK');return fail(res,access.code,access.message,403);}
  const bottle=await client.query("SELECT * FROM open_bottles WHERE id=$1 AND organisation_id=$2 AND outlet_id=$3 AND status='OPEN' FOR UPDATE",[req.params.bottleId,orgId(req),d.outletId]);
  if(!bottle.rowCount){await client.query('ROLLBACK');return fail(res,'OPEN_BOTTLE_NOT_FOUND','Open bottle not found',404);}
  const reserved=await client.query("SELECT COALESCE(SUM(reserved_ml-consumed_ml),0)::int amount FROM bar_bottle_reservations WHERE open_bottle_id=$1 AND status='ACTIVE' AND expires_at>NOW()",[req.params.bottleId]);
  const available=Number(bottle.rows[0].remaining_ml)-Number(reserved.rows[0].amount);
  if(available<d.volumeMl){await client.query('ROLLBACK');return res.status(409).json({error:{code:'INSUFFICIENT_UNRESERVED_ML',message:'Requested reservation exceeds unreserved bottle volume',availableMl:Math.max(0,available)}});}
  const created=await client.query(`INSERT INTO bar_bottle_reservations(organisation_id,outlet_id,open_bottle_id,product_id,reserved_ml,expires_at,reason,created_by)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[orgId(req),d.outletId,req.params.bottleId,bottle.rows[0].product_id,d.volumeMl,expiry,d.reason,req.auth!.userId]);
  await client.query(`INSERT INTO audit_events(organisation_id,outlet_id,actor_user_id,event_type,entity_type,entity_id,reason,metadata) VALUES($1,$2,$3,'BAR_BOTTLE_VOLUME_RESERVED','BAR_BOTTLE_RESERVATION',$4,$5,$6)`,[orgId(req),d.outletId,req.auth!.userId,created.rows[0].id,d.reason,{openBottleId:req.params.bottleId,volumeMl:d.volumeMl,expiresAt:expiry.toISOString()}]);
  await client.query('COMMIT');return res.status(201).json({data:created.rows[0],availableAfterReservationMl:available-d.volumeMl});
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
});
operationsRouter.post('/bar/bottle-reservations/:reservationId/release',requirePermission('peg:manage'),async(req,res)=>{
 const s=z.object({reason:z.string().trim().min(3).max(500)}).safeParse(req.body);if(!s.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:s.error.flatten()}});
 const client=await pool.connect();try{await client.query('BEGIN');
  const row=await client.query("SELECT * FROM bar_bottle_reservations WHERE id=$1 AND organisation_id=$2 FOR UPDATE",[req.params.reservationId,orgId(req)]);
  if(!row.rowCount){await client.query('ROLLBACK');return fail(res,'RESERVATION_NOT_FOUND','Bottle reservation not found',404);}
  if(row.rows[0].status!=='ACTIVE'){await client.query('ROLLBACK');return fail(res,'RESERVATION_NOT_ACTIVE','Only active reservations can be released',409);}
  const updated=await client.query("UPDATE bar_bottle_reservations SET status='RELEASED',released_by=$1,released_at=NOW(),reason=reason||' | Release: '||$2 WHERE id=$3 RETURNING *",[req.auth!.userId,s.data.reason,req.params.reservationId]);
  await client.query(`INSERT INTO audit_events(organisation_id,outlet_id,actor_user_id,event_type,entity_type,entity_id,reason,metadata) VALUES($1,$2,$3,'BAR_BOTTLE_RESERVATION_RELEASED','BAR_BOTTLE_RESERVATION',$4,$5,$6)`,[orgId(req),row.rows[0].outlet_id,req.auth!.userId,req.params.reservationId,s.data.reason,{openBottleId:row.rows[0].open_bottle_id,remainingReservedMl:Number(row.rows[0].reserved_ml)-Number(row.rows[0].consumed_ml)}]);
  await client.query('COMMIT');return res.json({data:updated.rows[0]});
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
});
operationsRouter.get('/bar/bottle-reservations',requirePermission('peg:read'),async(req,res)=>{
 const outletId=String(req.query.outletId??'');if(!uuid.safeParse(outletId).success)return fail(res,'INVALID_OUTLET_ID','A valid outletId is required');
 await pool.query("UPDATE bar_bottle_reservations SET status='EXPIRED' WHERE organisation_id=$1 AND outlet_id=$2 AND status='ACTIVE' AND expires_at<=NOW()",[orgId(req),outletId]);
 const rows=await pool.query(`SELECT r.*,b.remaining_ml FROM bar_bottle_reservations r JOIN open_bottles b ON b.id=r.open_bottle_id WHERE r.organisation_id=$1 AND r.outlet_id=$2 ORDER BY r.created_at DESC LIMIT 250`,[orgId(req),outletId]);return res.json({data:rows.rows});
});

// P09 bar tickets and tender collection. Peg consumption is a separate explicit transaction endpoint.
operationsRouter.post('/bar/tickets',requirePermission('bar:sell'),async(_req,res)=>{
  return res.status(410).json({error:{code:'ATOMIC_CHECKOUT_REQUIRED',message:'Use POST /api/v1/bar/checkout so ticket, payment and peg stock changes commit atomically'}});
});
operationsRouter.post('/bar/tickets/:ticketId/payments',requirePermission('bar:take_payment'),async(_req,res)=>{
  return res.status(410).json({error:{code:'ATOMIC_CHECKOUT_REQUIRED',message:'Separate bar payments are disabled; use POST /api/v1/bar/checkout'}});
});

// P10 shift opening, close preview and close with tender variance.
operationsRouter.post('/shifts/open',requirePermission('shift:manage'),async(req,res)=>{
 const s=z.object({outletId:uuid,shiftCode:z.string().min(1).max(50),openingCash:z.number().nonnegative().default(0)}).safeParse(req.body);
 if(!s.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:s.error.flatten()}});
 const client=await pool.connect();
 try{await client.query('BEGIN');
 const outlet=await client.query('SELECT id FROM outlets WHERE id=$1 AND organisation_id=$2 AND status=\'ACTIVE\' FOR UPDATE',[s.data.outletId,orgId(req)]);
 if(!outlet.rowCount){await client.query('ROLLBACK');return fail(res,'OUTLET_NOT_ACTIVE','Outlet not active',409);}
 const open=await client.query("SELECT id FROM outlet_shifts WHERE outlet_id=$1 AND organisation_id=$2 AND status='OPEN' FOR UPDATE",[s.data.outletId,orgId(req)]);
 if(open.rowCount){await client.query('ROLLBACK');return fail(res,'SHIFT_ALREADY_OPEN','An outlet can have only one open shift',409);}
 const r=await client.query(`INSERT INTO outlet_shifts(organisation_id,outlet_id,shift_code,opening_cash,opened_by)
 VALUES($1,$2,$3,$4,$5) RETURNING *`,[orgId(req),s.data.outletId,s.data.shiftCode,s.data.openingCash,req.auth!.userId]);
 await client.query('COMMIT');res.status(201).json({data:r.rows[0]});
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
});
operationsRouter.get('/shifts/current',requirePermission('shift:read'),async(req,res)=>{
 const outletId=typeof req.query.outletId==='string'?req.query.outletId:'';
 if(!z.string().uuid().safeParse(outletId).success)return fail(res,'INVALID_OUTLET_ID','A valid outletId is required');
 const r=await pool.query("SELECT * FROM outlet_shifts WHERE outlet_id=$1 AND organisation_id=$2 AND status='OPEN' ORDER BY opened_at DESC LIMIT 1",[outletId,orgId(req)]);
 return res.json({data:r.rows[0]??null});
});
operationsRouter.get('/shifts/:shiftId/preview',requirePermission('shift:read'),async(req,res)=>{
 const sh=await pool.query('SELECT * FROM outlet_shifts WHERE id=$1 AND organisation_id=$2',[req.params.shiftId,orgId(req)]);
 if(!sh.rowCount)return fail(res,'SHIFT_NOT_FOUND','Shift not found',404);
 const sales=await pool.query(`SELECT COALESCE(SUM(sp.amount),0) paid,sp.method FROM sale_payments sp JOIN retail_sales s ON s.id=sp.sale_id
 WHERE sp.organisation_id=$3 AND s.organisation_id=$3 AND s.outlet_id=$1 AND s.sold_at >= $2 AND s.sold_at <= NOW() GROUP BY sp.method`,[sh.rows[0].outlet_id,sh.rows[0].opened_at,orgId(req)]);
 const bar=await pool.query(`SELECT COALESCE(SUM(bp.amount),0) paid,bp.method FROM bar_payments bp JOIN bar_tickets t ON t.id=bp.ticket_id
 WHERE bp.organisation_id=$3 AND t.organisation_id=$3 AND t.outlet_id=$1 AND t.opened_at >= $2 AND t.opened_at <= NOW() GROUP BY bp.method`,[sh.rows[0].outlet_id,sh.rows[0].opened_at,orgId(req)]);
 const movements=await pool.query(`SELECT COALESCE(SUM(CASE WHEN direction='IN' THEN amount ELSE -amount END),0) total FROM shift_cash_movements WHERE organisation_id=$1 AND outlet_id=$2 AND shift_id=$3`,[orgId(req),sh.rows[0].outlet_id,req.params.shiftId]);
 const refunds=await pool.query(`SELECT (SELECT COALESCE(SUM(amount),0) FROM retail_refunds WHERE organisation_id=$3 AND outlet_id=$1 AND refund_method='CASH' AND created_at >= $2)+(SELECT COALESCE(SUM(amount),0) FROM bar_refunds WHERE organisation_id=$3 AND outlet_id=$1 AND refund_method='CASH' AND created_at >= $2) total`,[sh.rows[0].outlet_id,sh.rows[0].opened_at,orgId(req)]);
 const cashRetail=sales.rows.filter((r:any)=>r.method==='CASH').reduce((sum:number,r:any)=>sum+Number(r.paid),0);
 const cashBar=bar.rows.filter((r:any)=>r.method==='CASH').reduce((sum:number,r:any)=>sum+Number(r.paid),0);
 const expectedCash=Number(sh.rows[0].opening_cash)+cashRetail+cashBar+Number(movements.rows[0].total)-Number(refunds.rows[0].total);
 res.json({data:{shift:sh.rows[0],retailTenders:sales.rows,barTenders:bar.rows,cashMovements:movements.rows[0],cashRefunds:Number(refunds.rows[0].total),expectedCash}});
});
operationsRouter.post('/shifts/:shiftId/close',requirePermission('shift:manage'),async(req,res)=>{
 const s=z.object({declaredCash:z.number().nonnegative(),notes:z.string().max(2000).optional()}).safeParse(req.body);
 if(!s.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:s.error.flatten()}});
 const client=await pool.connect();
 try{await client.query('BEGIN');
 const sh=await client.query('SELECT * FROM outlet_shifts WHERE id=$1 AND organisation_id=$2 FOR UPDATE',[req.params.shiftId,orgId(req)]);
 if(!sh.rowCount){await client.query('ROLLBACK');return fail(res,'SHIFT_NOT_FOUND','Shift not found',404);}
 if(sh.rows[0].status!=='OPEN'){await client.query('ROLLBACK');return fail(res,'SHIFT_NOT_OPEN','Only open shifts can be closed',409);}
 const cashRetail=await client.query(`SELECT COALESCE(SUM(sp.amount),0) total FROM sale_payments sp JOIN retail_sales s ON s.id=sp.sale_id
 WHERE sp.organisation_id=$3 AND s.organisation_id=$3 AND s.outlet_id=$1 AND sp.method='CASH' AND s.sold_at >= $2`,[sh.rows[0].outlet_id,sh.rows[0].opened_at,orgId(req)]);
 const cashBar=await client.query(`SELECT COALESCE(SUM(bp.amount),0) total FROM bar_payments bp JOIN bar_tickets t ON t.id=bp.ticket_id
 WHERE bp.organisation_id=$3 AND t.organisation_id=$3 AND t.outlet_id=$1 AND bp.method='CASH' AND t.opened_at >= $2`,[sh.rows[0].outlet_id,sh.rows[0].opened_at,orgId(req)]);
 const cashMovements=await client.query(`SELECT COALESCE(SUM(CASE WHEN direction='IN' THEN amount ELSE -amount END),0) total FROM shift_cash_movements WHERE organisation_id=$1 AND outlet_id=$2 AND shift_id=$3`,[orgId(req),sh.rows[0].outlet_id,req.params.shiftId]);
 const cashRefunds=await client.query(`SELECT (SELECT COALESCE(SUM(amount),0) FROM retail_refunds WHERE organisation_id=$3 AND outlet_id=$1 AND refund_method='CASH' AND created_at >= $2)+(SELECT COALESCE(SUM(amount),0) FROM bar_refunds WHERE organisation_id=$3 AND outlet_id=$1 AND refund_method='CASH' AND created_at >= $2) total`,[sh.rows[0].outlet_id,sh.rows[0].opened_at,orgId(req)]);
 const expected=Number(sh.rows[0].opening_cash)+Number(cashRetail.rows[0].total)+Number(cashBar.rows[0].total)+Number(cashMovements.rows[0].total)-Number(cashRefunds.rows[0].total);
 const variance=s.data.declaredCash-expected;
 const u=await client.query(`UPDATE outlet_shifts SET status='CLOSED',closed_by=$1,closed_at=NOW(),closing_cash_declared=$2,expected_cash=$3,cash_variance=$4,notes=$5
 WHERE id=$6 AND organisation_id=$7 RETURNING *`,[req.auth!.userId,s.data.declaredCash,expected,variance,s.data.notes ?? null,req.params.shiftId,orgId(req)]);
 await client.query(`INSERT INTO shift_events(shift_id,event_type,payload,actor_id) VALUES($1,'CLOSED',$2,$3)`,[req.params.shiftId,{expectedCash:expected,declaredCash:s.data.declaredCash,variance},req.auth!.userId]);
 await client.query('COMMIT');res.json({data:u.rows[0],reconciliation:{expectedCash:expected,declaredCash:s.data.declaredCash,variance}});
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
});
