import { Router } from 'express';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { requireOrgScope } from '../middleware/requireOrgScope.js';
import { appendStockMovementOnce } from '../services/stockMovementIdempotency.js';

export const ecosystemRouter=Router();
ecosystemRouter.use(authenticate,requireOrgScope);
const uuid=z.string().uuid();
const org=(req:any)=>req.auth.organisationId as string;
const bad=(res:any,code:string,message:string,status=400)=>res.status(status).json({error:{code,message}});
const valid=(schema:z.ZodTypeAny,body:unknown)=>schema.safeParse(body);

// P11: controlled stock transfers between outlets; transfer receipt is separately acknowledged.
ecosystemRouter.post('/outlet-transfers',requirePermission('outlet:transfer'),async(req,res)=>{
 const s=valid(z.object({fromOutletId:uuid,toOutletId:uuid,transferNumber:z.string().min(2),lines:z.array(z.object({productId:uuid,quantity:z.number().positive()})).min(1)}),req.body);
 if(!s.success)return res.status(400).json({error:s.error.flatten()});
 const d=s.data,c=await pool.connect();
 try{await c.query('BEGIN');
 const outlets=await c.query('SELECT id FROM outlets WHERE organisation_id=$1 AND id=ANY($2::uuid[])',[org(req),[d.fromOutletId,d.toOutletId]]);
 if(outlets.rowCount!==2){await c.query('ROLLBACK');return bad(res,'OUTLET_SCOPE_INVALID','Both outlets must belong to this organisation',404);}
 const t=await c.query(`INSERT INTO outlet_transfers(organisation_id,from_outlet_id,to_outlet_id,transfer_number,created_by)
 VALUES($1,$2,$3,$4,$5) RETURNING *`,[org(req),d.fromOutletId,d.toOutletId,d.transferNumber,req.auth!.userId]);
 for(const l of d.lines){
  const b=await c.query('SELECT quantity_units FROM stock_balances WHERE outlet_id=$1 AND product_id=$2 AND organisation_id=$3 FOR UPDATE',[d.fromOutletId,l.productId,org(req)]);
  if(!b.rowCount||Number(b.rows[0].quantity_units)<l.quantity){await c.query('ROLLBACK');return bad(res,'INSUFFICIENT_STOCK','Insufficient source outlet stock',409);}
  const debited=await c.query('UPDATE stock_balances SET quantity_units=quantity_units-$1 WHERE organisation_id=$4 AND outlet_id=$2 AND product_id=$3 AND quantity_units >= $1 RETURNING product_id',[l.quantity,d.fromOutletId,l.productId,org(req)]);if(!debited.rowCount){await c.query('ROLLBACK');return bad(res,'INSUFFICIENT_STOCK','Source stock changed; retry the transfer',409);}
  const transferLine=await c.query('INSERT INTO outlet_transfer_lines(transfer_id,product_id,quantity) VALUES($1,$2,$3) RETURNING id',[t.rows[0].id,l.productId,l.quantity]);
  await appendStockMovementOnce(c,{organisationId:org(req),outletId:d.fromOutletId,productId:l.productId,movementType:'TRANSFER_OUT',quantityUnits:l.quantity,referenceType:'OUTLET_TRANSFER_LINE',referenceId:transferLine.rows[0].id,idempotencyKey:`outlet-transfer:${transferLine.rows[0].id}:out`,createdBy:req.auth!.userId});
 }
 await c.query("UPDATE outlet_transfers SET status='DISPATCHED',dispatched_at=NOW() WHERE id=$1 AND organisation_id=$2",[t.rows[0].id,org(req)]);
 await c.query('COMMIT');res.status(201).json({data:t.rows[0]});
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
});
ecosystemRouter.post('/outlet-transfers/:transferId/receive',requirePermission('outlet:transfer'),async(req,res)=>{
 const s=valid(z.object({received:z.array(z.object({lineId:uuid,quantity:z.number().nonnegative()}))}),req.body);
 if(!s.success)return res.status(400).json({error:s.error.flatten()});
 const c=await pool.connect();
 try{await c.query('BEGIN');
 const t=await c.query("SELECT * FROM outlet_transfers WHERE id=$1 AND organisation_id=$2 FOR UPDATE",[req.params.transferId,org(req)]);
 if(!t.rowCount||t.rows[0].status!=='DISPATCHED'){await c.query('ROLLBACK');return bad(res,'TRANSFER_NOT_DISPATCHED','Transfer is not awaiting receipt',409);}
 for(const line of s.data.received){
  const l=await c.query('SELECT l.* FROM outlet_transfer_lines l JOIN outlet_transfers t ON t.id=l.transfer_id AND t.organisation_id=$3 WHERE l.id=$1 AND l.transfer_id=$2',[line.lineId,req.params.transferId,org(req)]);
  if(!l.rowCount||line.quantity>Number(l.rows[0].quantity)){await c.query('ROLLBACK');return bad(res,'INVALID_RECEIPT','Invalid received quantity');}
  await c.query('UPDATE outlet_transfer_lines SET received_quantity=$1 WHERE id=$2 AND transfer_id IN (SELECT id FROM outlet_transfers WHERE id=$3 AND organisation_id=$4)',[line.quantity,line.lineId,req.params.transferId,org(req)]);
  if(line.quantity>0){
   await c.query(`INSERT INTO stock_balances(organisation_id,outlet_id,product_id,quantity_units) VALUES($1,$2,$3,$4)
    ON CONFLICT(outlet_id,product_id) DO UPDATE SET quantity_units=stock_balances.quantity_units+EXCLUDED.quantity_units WHERE stock_balances.organisation_id=EXCLUDED.organisation_id`,
    [org(req),t.rows[0].to_outlet_id,l.rows[0].product_id,line.quantity]);
   await appendStockMovementOnce(c,{organisationId:org(req),outletId:t.rows[0].to_outlet_id,productId:l.rows[0].product_id,movementType:'TRANSFER_IN',quantityUnits:line.quantity,referenceType:'OUTLET_TRANSFER_LINE',referenceId:line.lineId,idempotencyKey:`outlet-transfer:${line.lineId}:in`,createdBy:req.auth!.userId});
  }
 }
 await c.query("UPDATE outlet_transfers SET status='RECEIVED',received_at=NOW() WHERE id=$1 AND organisation_id=$2",[req.params.transferId,org(req)]);
 await c.query('COMMIT');res.json({ok:true});
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
});

// P12: operating expenses and accounting export requests.
ecosystemRouter.post('/finance/expenses',requirePermission('finance:manage'),async(req,res)=>{
 const s=valid(z.object({outletId:uuid.optional(),category:z.string().min(2),description:z.string().min(2),amount:z.number().positive(),expenseDate:z.string().optional(),paymentMethod:z.string().optional(),reference:z.string().optional()}),req.body);
 if(!s.success)return res.status(400).json({error:s.error.flatten()});
 const d=s.data,r=await pool.query(`INSERT INTO expenses(organisation_id,outlet_id,category,description,amount,expense_date,payment_method,reference,created_by)
 VALUES($1,$2,$3,$4,$5,COALESCE($6::date,CURRENT_DATE),$7,$8,$9) RETURNING *`,
 [org(req),d.outletId??null,d.category,d.description,d.amount,d.expenseDate??null,d.paymentMethod??null,d.reference??null,req.auth!.userId]);
 res.status(201).json({data:r.rows[0]});
});
ecosystemRouter.get('/finance/summary',requirePermission('finance:read'),async(req,res)=>{
 const [sales,expenses]=await Promise.all([
  pool.query('SELECT COALESCE(SUM(grand_total),0) total FROM retail_sales WHERE organisation_id=$1 AND status=\'COMPLETED\'',[org(req)]),
  pool.query('SELECT COALESCE(SUM(amount),0) total FROM expenses WHERE organisation_id=$1',[org(req)])
 ]);
 res.json({data:{grossRetailSales:Number(sales.rows[0].total),expenses:Number(expenses.rows[0].total)}});
});
ecosystemRouter.post('/finance/exports',requirePermission('finance:manage'),async(req,res)=>{
 const s=valid(z.object({type:z.enum(['TALLY_CSV','GST_SUMMARY','LEDGER_CSV']),from:z.string(),to:z.string()}),req.body);
 if(!s.success)return res.status(400).json({error:s.error.flatten()});
 const r=await pool.query(`INSERT INTO accounting_exports(organisation_id,export_type,period_start,period_end) VALUES($1,$2,$3,$4) RETURNING *`,[org(req),s.data.type,s.data.from,s.data.to]);
 res.status(202).json({data:r.rows[0],message:'Export queued; file generation worker must be configured.'});
});

// P13: CRM customer records and explicit consent ledger.
ecosystemRouter.post('/crm/customers',requirePermission('crm:manage'),async(req,res)=>{
 const s=valid(z.object({displayName:z.string().max(120).optional(),phone:z.string().max(20).optional(),email:z.string().email().optional()}),req.body);
 if(!s.success)return res.status(400).json({error:s.error.flatten()});
 const r=await pool.query(`INSERT INTO customers(organisation_id,display_name,phone_e164,email) VALUES($1,$2,$3,$4)
 ON CONFLICT(organisation_id,phone_e164) DO UPDATE SET display_name=COALESCE(EXCLUDED.display_name,customers.display_name),email=COALESCE(EXCLUDED.email,customers.email)
 RETURNING id,display_name,phone_e164,email,status,created_at`,[org(req),s.data.displayName??null,s.data.phone??null,s.data.email??null]);
 res.status(201).json({data:r.rows[0]});
});
ecosystemRouter.post('/crm/customers/:customerId/consents',requirePermission('crm:manage'),async(req,res)=>{
 const s=valid(z.object({purpose:z.enum(['SERVICE_MESSAGES','LOYALTY','MARKETING']),granted:z.boolean(),policyVersion:z.string().min(1),channel:z.string().optional()}),req.body);
 if(!s.success)return res.status(400).json({error:s.error.flatten()});
 const c=await pool.query('SELECT id FROM customers WHERE id=$1 AND organisation_id=$2',[req.params.customerId,org(req)]);
 if(!c.rowCount)return bad(res,'CUSTOMER_NOT_FOUND','Customer not found',404);
 const r=await pool.query(`INSERT INTO customer_consents(organisation_id,customer_id,purpose,granted,policy_version,capture_channel,revoked_at)
 VALUES($1,$2,$3,$4,$5,$6,CASE WHEN $4 THEN NULL ELSE NOW() END) RETURNING *`,
 [org(req),req.params.customerId,s.data.purpose,s.data.granted,s.data.policyVersion,s.data.channel??null]);
 res.status(201).json({data:r.rows[0]});
});

// P14: brand campaign drafting and outlet targeting. Activation is subject to separate legal review.
ecosystemRouter.post('/brands/campaigns',requirePermission('brand:manage'),async(req,res)=>{
 const s=valid(z.object({name:z.string().min(2),objective:z.string().min(2),startsAt:z.string().optional(),endsAt:z.string().optional(),outletIds:z.array(uuid).default([])}),req.body);
 if(!s.success)return res.status(400).json({error:s.error.flatten()});
 const c=await pool.connect();
 try{await c.query('BEGIN');
 const b=await c.query('INSERT INTO brand_campaigns(organisation_id,name,objective,starts_at,ends_at,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
 [org(req),s.data.name,s.data.objective,s.data.startsAt??null,s.data.endsAt??null,req.auth!.userId]);
 for(const outletId of s.data.outletIds){
  const o=await c.query('SELECT id FROM outlets WHERE id=$1',[outletId]);
  if(!o.rowCount){await c.query('ROLLBACK');return bad(res,'OUTLET_NOT_FOUND','Target outlet not found',404);}
  await c.query('INSERT INTO brand_campaign_outlets(campaign_id,outlet_id) VALUES($1,$2)',[b.rows[0].id,outletId]);
 }
 await c.query('COMMIT');res.status(201).json({data:b.rows[0]});
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
});
ecosystemRouter.post('/brands/campaigns/:campaignId/review',requirePermission('brand:manage'),async(req,res)=>{
 if(!req.auth!.isPlatformAdmin)return bad(res,'PLATFORM_ADMIN_REQUIRED','Campaign review requires platform admin',403);
 const s=valid(z.object({decision:z.enum(['APPROVED','REJECTED','PAUSED']),reviewReference:z.string().min(4)}),req.body);
 if(!s.success)return res.status(400).json({error:s.error.flatten()});
 const r=await pool.query('UPDATE brand_campaigns SET status=$1 WHERE id=$2 RETURNING *',[s.data.decision,req.params.campaignId]);
 if(!r.rowCount)return bad(res,'CAMPAIGN_NOT_FOUND','Campaign not found',404);
 res.json({data:r.rows[0],reviewReference:s.data.reviewReference});
});
ecosystemRouter.get('/brands/campaigns',requirePermission('brand:read'),async(req,res)=>{
 const r=await pool.query('SELECT * FROM brand_campaigns WHERE organisation_id=$1 ORDER BY created_at DESC',[org(req)]);res.json({data:r.rows});
});

// P15: platform-admin maps a verified distributor to an outlet.
ecosystemRouter.post('/platform/distributor-assignments',requirePermission('distributor:manage'),async(req,res)=>{
 if(!req.auth!.isPlatformAdmin)return bad(res,'PLATFORM_ADMIN_REQUIRED','Platform admin required',403);
 const s=valid(z.object({distributorOrganisationId:uuid,outletId:uuid,territoryCode:z.string().optional()}),req.body);
 if(!s.success)return res.status(400).json({error:s.error.flatten()});
 const r=await pool.query(`INSERT INTO distributor_outlet_assignments(distributor_org_id,outlet_id,territory_code)
 VALUES($1,$2,$3) ON CONFLICT(distributor_org_id,outlet_id) DO UPDATE SET territory_code=EXCLUDED.territory_code,status='ACTIVE' RETURNING *`,
 [s.data.distributorOrganisationId,s.data.outletId,s.data.territoryCode??null]);
 res.status(201).json({data:r.rows[0]});
});
// P15: distributor order capture; fulfilment requires a separately verified distributor workflow.
ecosystemRouter.post('/distributor/orders',requirePermission('distributor:manage'),async(req,res)=>{
 const s=valid(z.object({outletId:uuid,orderNumber:z.string().min(2),lines:z.array(z.object({productId:uuid,quantity:z.number().positive(),quotedPrice:z.number().nonnegative().optional()})).min(1)}),req.body);
 if(!s.success)return res.status(400).json({error:s.error.flatten()});
 const c=await pool.connect();
 try{await c.query('BEGIN');
 const assignment=await c.query(`SELECT 1 FROM distributor_outlet_assignments WHERE distributor_org_id=$1 AND outlet_id=$2 AND status='ACTIVE'`,[org(req),s.data.outletId]);
 if(!assignment.rowCount){await c.query('ROLLBACK');return bad(res,'OUTLET_NOT_ASSIGNED','Outlet is not assigned to this distributor',403);}
 const d=await c.query('INSERT INTO distributor_orders(organisation_id,outlet_id,order_number) VALUES($1,$2,$3) RETURNING *',[org(req),s.data.outletId,s.data.orderNumber]);
 for(const l of s.data.lines)await c.query('INSERT INTO distributor_order_lines(order_id,product_id,quantity,quoted_price) VALUES($1,$2,$3,$4)',[d.rows[0].id,l.productId,l.quantity,l.quotedPrice??null]);
 await c.query('COMMIT');res.status(201).json({data:d.rows[0]});
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
});
ecosystemRouter.get('/distributor/orders',requirePermission('distributor:read'),async(req,res)=>{
 const r=await pool.query('SELECT * FROM distributor_orders WHERE organisation_id=$1 ORDER BY requested_at DESC',[org(req)]);res.json({data:r.rows});
});

// P16: retailer/bar outlet enrols in a brand trade scheme.
ecosystemRouter.post('/trade/schemes/:schemeId/enrol',requirePermission('trade:manage'),async(req,res)=>{
 const s=valid(z.object({outletId:uuid}),req.body);
 if(!s.success)return res.status(400).json({error:s.error.flatten()});
 const outlet=await pool.query('SELECT id FROM outlets WHERE id=$1 AND organisation_id=$2',[s.data.outletId,org(req)]);
 if(!outlet.rowCount)return bad(res,'OUTLET_NOT_FOUND','Outlet not found in this organisation',404);
 const scheme=await pool.query("SELECT id FROM trade_schemes WHERE id=$1 AND status IN ('APPROVED','ACTIVE')",[req.params.schemeId]);
 if(!scheme.rowCount)return bad(res,'SCHEME_NOT_AVAILABLE','Scheme is not approved or active',409);
 const r=await pool.query(`INSERT INTO trade_scheme_participants(scheme_id,outlet_id) VALUES($1,$2)
 ON CONFLICT(scheme_id,outlet_id) DO UPDATE SET status='ENROLLED' RETURNING *`,[req.params.schemeId,s.data.outletId]);
 res.status(201).json({data:r.rows[0]});
});
// P16: trade schemes and field visits.
ecosystemRouter.post('/trade/schemes',requirePermission('trade:manage'),async(req,res)=>{
 const s=valid(z.object({name:z.string().min(2),description:z.string().optional(),startsAt:z.string().optional(),endsAt:z.string().optional()}),req.body);
 if(!s.success)return res.status(400).json({error:s.error.flatten()});
 const r=await pool.query('INSERT INTO trade_schemes(brand_org_id,name,description,starts_at,ends_at) VALUES($1,$2,$3,$4,$5) RETURNING *',[org(req),s.data.name,s.data.description??null,s.data.startsAt??null,s.data.endsAt??null]);
 res.status(201).json({data:r.rows[0]});
});
ecosystemRouter.post('/trade/visits',requirePermission('trade:visit'),async(req,res)=>{
 const s=valid(z.object({outletId:uuid,notes:z.string().max(1000).optional(),audit:z.record(z.any()).optional()}),req.body);
 if(!s.success)return res.status(400).json({error:s.error.flatten()});
 const allowed=await pool.query(`SELECT 1 FROM outlets WHERE id=$1 AND organisation_id=$2
 UNION SELECT 1 FROM distributor_outlet_assignments WHERE outlet_id=$1 AND distributor_org_id=$2 AND status='ACTIVE'
 UNION SELECT 1 FROM trade_scheme_participants tsp JOIN trade_schemes ts ON ts.id=tsp.scheme_id WHERE tsp.outlet_id=$1 AND ts.brand_org_id=$2 AND tsp.status='ENROLLED' LIMIT 1`,[s.data.outletId,org(req)]);
 if(!allowed.rowCount)return bad(res,'OUTLET_NOT_ASSIGNED','Outlet is not in an approved trade relationship',403);
 const r=await pool.query(`INSERT INTO field_visits(organisation_id,outlet_id,representative_id,notes,check_in_at,audit_payload)
 VALUES($1,$2,$3,$4,NOW(),$5) RETURNING *`,[org(req),s.data.outletId,req.auth!.userId,s.data.notes??null,s.data.audit??{}]);
 res.status(201).json({data:r.rows[0]});
});
ecosystemRouter.post('/trade/visits/:visitId/checkout',requirePermission('trade:visit'),async(req,res)=>{
 const r=await pool.query('UPDATE field_visits SET check_out_at=NOW(),visit_status=\'COMPLETED\' WHERE id=$1 AND organisation_id=$2 AND representative_id=$3 RETURNING *',[req.params.visitId,org(req),req.auth!.userId]);
 if(!r.rowCount)return bad(res,'VISIT_NOT_FOUND','Visit not found',404);res.json({data:r.rows[0]});
});

// P17: record the jurisdiction-specific legal review gate for an organisation.
ecosystemRouter.post('/platform/consumer-discovery/:organisationId/enable',requirePermission('consumer:review'),async(req,res)=>{
 if(!req.auth!.isPlatformAdmin)return bad(res,'PLATFORM_ADMIN_REQUIRED','Platform admin required',403);
 const s=valid(z.object({legalReviewReference:z.string().min(4),approvedActivities:z.array(z.string()).min(1)}),req.body);
 if(!s.success)return res.status(400).json({error:s.error.flatten()});
 const r=await pool.query(`INSERT INTO consumer_discovery_settings(organisation_id,discovery_enabled,legal_review_reference,approved_at)
 VALUES($1,TRUE,$2,NOW()) ON CONFLICT(organisation_id) DO UPDATE SET discovery_enabled=TRUE,legal_review_reference=EXCLUDED.legal_review_reference,approved_at=NOW(),updated_at=NOW()
 RETURNING *`,[req.params.organisationId,s.data.legalReviewReference]);
 res.json({data:r.rows[0],approvedActivities:s.data.approvedActivities});
});
// P17: consumer-facing discovery only. Listings remain hidden unless a legal review is recorded.
ecosystemRouter.post('/consumer/listings',requirePermission('consumer:manage'),async(req,res)=>{
 const s=valid(z.object({outletId:uuid,publicName:z.string().min(2),publicAddress:z.record(z.any()).optional(),publicHours:z.record(z.any()).optional()}),req.body);
 if(!s.success)return res.status(400).json({error:s.error.flatten()});
 const r=await pool.query(`INSERT INTO consumer_public_listings(organisation_id,outlet_id,public_name,public_address,public_hours)
 VALUES($1,$2,$3,$4,$5) RETURNING *`,[org(req),s.data.outletId,s.data.publicName,s.data.publicAddress??{},s.data.publicHours??{}]);
 res.status(201).json({data:r.rows[0],message:'Listing is hidden pending jurisdiction-specific legal review.'});
});
ecosystemRouter.post('/consumer/listings/:listingId/review',requirePermission('consumer:review'),async(req,res)=>{
 if(!req.auth!.isPlatformAdmin)return bad(res,'PLATFORM_ADMIN_REQUIRED','Legal listing review is restricted to platform admin',403);
 const s=valid(z.object({decision:z.enum(['PUBLISHED','WITHDRAWN','HIDDEN']),legalReviewReference:z.string().min(4),notes:z.string().optional()}),req.body);
 if(!s.success)return res.status(400).json({error:s.error.flatten()});
 const c=await pool.connect();
 try{await c.query('BEGIN');
 const listing=await c.query('SELECT organisation_id FROM consumer_public_listings WHERE id=$1',[req.params.listingId]);
 if(!listing.rowCount){await c.query('ROLLBACK');return bad(res,'LISTING_NOT_FOUND','Listing not found',404);}
 if(s.data.decision==='PUBLISHED'){
  const gate=await c.query('SELECT 1 FROM consumer_discovery_settings WHERE organisation_id=$1 AND discovery_enabled=TRUE AND legal_review_reference=$2',[listing.rows[0].organisation_id,s.data.legalReviewReference]);
  if(!gate.rowCount){await c.query('ROLLBACK');return bad(res,'LEGAL_GATE_NOT_ENABLED','Consumer discovery legal gate is not enabled for this organisation',403);}
 }
 const l=await c.query('UPDATE consumer_public_listings SET status=$1,approved_by=$2,approved_at=NOW() WHERE id=$3 RETURNING *',[s.data.decision,req.auth!.userId,req.params.listingId]);
 if(!l.rowCount){await c.query('ROLLBACK');return bad(res,'LISTING_NOT_FOUND','Listing not found',404);}
 await c.query('INSERT INTO consumer_listing_audit(listing_id,action,actor_id,notes) VALUES($1,$2,$3,$4)',[req.params.listingId,s.data.decision,req.auth!.userId,`${s.data.legalReviewReference}: ${s.data.notes??''}`]);
 await c.query('COMMIT');res.json({data:l.rows[0]});
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
});

// P18: report job queue and summary endpoints. A worker must render/export queued reports.
ecosystemRouter.post('/analytics/reports',requirePermission('analytics:read'),async(req,res)=>{
 const s=valid(z.object({reportKey:z.enum(['SALES_SUMMARY','INVENTORY_VALUATION','PEG_VARIANCE','SHIFT_RECONCILIATION','OUTLET_PERFORMANCE']),parameters:z.record(z.any()).optional()}),req.body);
 if(!s.success)return res.status(400).json({error:s.error.flatten()});
 const r=await pool.query('INSERT INTO report_runs(organisation_id,report_key,parameters,requested_by) VALUES($1,$2,$3,$4) RETURNING *',[org(req),s.data.reportKey,s.data.parameters??{},req.auth!.userId]);
 res.status(202).json({data:r.rows[0]});
});
ecosystemRouter.get('/analytics/sales-summary',requirePermission('analytics:read'),async(req,res)=>{
 const r=await pool.query(`SELECT outlet_id,COUNT(*) sale_count,COALESCE(SUM(grand_total),0) gross_sales
 FROM retail_sales WHERE organisation_id=$1 AND status='COMPLETED' GROUP BY outlet_id ORDER BY gross_sales DESC`,[org(req)]);
 res.json({data:r.rows});
});

// P19: device registration. Store only a one-way hash of the device secret.
ecosystemRouter.post('/sync/devices',requirePermission('sync:manage'),async(req,res)=>{
 const s=valid(z.object({outletId:uuid,deviceSecret:z.string().min(32),deviceLabel:z.string().max(100).optional()}),req.body);
 if(!s.success)return res.status(400).json({error:s.error.flatten()});
 const outlet=await pool.query('SELECT id FROM outlets WHERE id=$1 AND organisation_id=$2',[s.data.outletId,org(req)]);
 if(!outlet.rowCount)return bad(res,'OUTLET_NOT_FOUND','Outlet not found',404);
 const digest=createHash('sha256').update(s.data.deviceSecret).digest('hex');
 const r=await pool.query(`INSERT INTO device_registrations(organisation_id,outlet_id,device_key_hash,device_label)
 VALUES($1,$2,$3,$4) RETURNING id,outlet_id,device_label,status,created_at`,
 [org(req),s.data.outletId,digest,s.data.deviceLabel??null]);
 res.status(201).json({data:r.rows[0]});
});
// P19: offline sync batch ingestion is idempotent. Domain-specific conflict resolution is still required.
ecosystemRouter.post('/sync/batches',requirePermission('sync:manage'),async(req,res)=>{
 const s=valid(z.object({outletId:uuid,deviceId:uuid.optional(),idempotencyKey:z.string().min(8),events:z.array(z.object({type:z.string().min(2),payload:z.record(z.any())})).min(1).max(500)}),req.body);
 if(!s.success)return res.status(400).json({error:s.error.flatten()});
 const outlet=await pool.query('SELECT id FROM outlets WHERE id=$1 AND organisation_id=$2',[s.data.outletId,org(req)]);
 if(!outlet.rowCount)return bad(res,'OUTLET_NOT_FOUND','Outlet not found',404);
 if(s.data.deviceId){
  const device=await pool.query(`SELECT id FROM device_registrations WHERE id=$1 AND organisation_id=$2 AND outlet_id=$3 AND status='ACTIVE'`,[s.data.deviceId,org(req),s.data.outletId]);
  if(!device.rowCount)return bad(res,'DEVICE_NOT_REGISTERED','Device is not active for this outlet',403);
 }
 const payload=JSON.stringify(s.data.events),hash=createHash('sha256').update(payload).digest('hex');
 const r=await pool.query(`INSERT INTO sync_batches(organisation_id,outlet_id,device_id,idempotency_key,payload_hash,status,result)
 VALUES($1,$2,$3,$4,$5,'RECEIVED',$6) ON CONFLICT(outlet_id,idempotency_key) DO NOTHING RETURNING *`,
 [org(req),s.data.outletId,s.data.deviceId??null,s.data.idempotencyKey,hash,{acceptedEvents:s.data.events.length}]);
 if(!r.rowCount){
  const old=await pool.query('SELECT * FROM sync_batches WHERE outlet_id=$1 AND idempotency_key=$2',[s.data.outletId,s.data.idempotencyKey]);
  if(old.rows[0].payload_hash!==hash)return bad(res,'IDEMPOTENCY_CONFLICT','Idempotency key was used with a different payload',409);
  return res.json({data:old.rows[0],replay:true});
 }
 res.status(202).json({data:r.rows[0],message:'Batch accepted; event processor and conflict policy must be configured.'});
});

// P20: operational alert and release-gate records.
ecosystemRouter.post('/platform/ops/alerts',requirePermission('ops:manage'),async(req,res)=>{
 if(!req.auth!.isPlatformAdmin)return bad(res,'PLATFORM_ADMIN_REQUIRED','Platform admin required',403);
 const s=valid(z.object({organisationId:uuid.optional(),severity:z.enum(['INFO','WARNING','CRITICAL']),key:z.string().min(2),message:z.string().min(2)}),req.body);
 if(!s.success)return res.status(400).json({error:s.error.flatten()});
 const r=await pool.query('INSERT INTO operational_alerts(organisation_id,severity,alert_key,message) VALUES($1,$2,$3,$4) RETURNING *',[s.data.organisationId??null,s.data.severity,s.data.key,s.data.message]);
 res.status(201).json({data:r.rows[0]});
});
ecosystemRouter.post('/platform/ops/release-checks',requirePermission('ops:manage'),async(req,res)=>{
 if(!req.auth!.isPlatformAdmin)return bad(res,'PLATFORM_ADMIN_REQUIRED','Platform admin required',403);
 const s=valid(z.object({version:z.string().min(1),checkKey:z.string().min(2),status:z.enum(['PENDING','PASS','FAIL','WAIVED']),evidenceUri:z.string().url().optional(),notes:z.string().optional()}),req.body);
 if(!s.success)return res.status(400).json({error:s.error.flatten()});
 const r=await pool.query(`INSERT INTO release_checks(release_version,check_key,status,evidence_uri,checked_by,checked_at)
 VALUES($1,$2,$3,$4,$5,CASE WHEN $3='PENDING' THEN NULL ELSE NOW() END)
 ON CONFLICT(release_version,check_key) DO UPDATE SET status=EXCLUDED.status,evidence_uri=EXCLUDED.evidence_uri,checked_by=EXCLUDED.checked_by,checked_at=EXCLUDED.checked_at RETURNING *`,
 [s.data.version,s.data.checkKey,s.data.status,s.data.evidenceUri??null,req.auth!.email]);
 res.status(201).json({data:r.rows[0]});
});
