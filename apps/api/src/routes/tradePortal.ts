import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { requireOrgScope } from '../middleware/requireOrgScope.js';

export const tradePortalRouter = Router();
tradePortalRouter.use(authenticate, requireOrgScope);
const uuid = z.string().uuid();
const org = (req: any) => req.auth.organisationId as string;
const fail = (res: any, code: string, message: string, status = 400) =>
  res.status(status).json({ error: { code, message } });

// Partner organisation submits a brand/distributor profile. Platform review is separate.
tradePortalRouter.post('/trade/profile', requirePermission('trade:manage'), async (req: any, res: any) => {
  const parsed = z.object({
    partnerType: z.enum(['BRAND','DISTRIBUTOR']),
    publicName: z.string().trim().min(2).max(160),
    gstin: z.string().trim().max(15).optional(),
    contactEmail: z.string().email().optional(),
    contactPhone: z.string().trim().max(30).optional()
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const organisation = await pool.query('SELECT organisation_type FROM organisations WHERE id=$1', [org(req)]);
  if (!organisation.rowCount || !['BRAND','DISTRIBUTOR'].includes(organisation.rows[0].organisation_type))
    return fail(res,'PARTNER_ORGANISATION_REQUIRED','Only brand or distributor organisations can submit this profile',403);
  const d=parsed.data;
  const r=await pool.query(`INSERT INTO trade_partner_profiles
    (organisation_id,partner_type,public_name,gstin,contact_email,contact_phone,status)
    VALUES($1,$2,$3,$4,$5,$6,'SUBMITTED')
    ON CONFLICT(organisation_id) DO UPDATE SET partner_type=EXCLUDED.partner_type,
      public_name=EXCLUDED.public_name,gstin=EXCLUDED.gstin,contact_email=EXCLUDED.contact_email,
      contact_phone=EXCLUDED.contact_phone,status=CASE WHEN trade_partner_profiles.status='APPROVED'
      THEN 'APPROVED' ELSE 'SUBMITTED' END,updated_at=NOW() RETURNING *`,
    [org(req),d.partnerType,d.publicName,d.gstin??null,d.contactEmail??null,d.contactPhone??null]);
  res.status(201).json({data:r.rows[0]});
});

// Explicit platform approval is required before an organisation can be listed as a trade supplier.
tradePortalRouter.post('/platform/trade/profiles/:organisationId/approve', requirePermission('platform:manage'), async(req: any,res: any)=>{
  const parsed=z.object({}).safeParse(req.body??{});
  if(!uuid.safeParse(req.params.organisationId).success)return fail(res,'INVALID_ORGANISATION_ID','Invalid organisation id');
  const r=await pool.query(`UPDATE trade_partner_profiles SET status='APPROVED',updated_at=NOW()
    WHERE organisation_id=$1 AND status='SUBMITTED' RETURNING *`,[req.params.organisationId]);
  if(!r.rowCount)return fail(res,'PROFILE_NOT_SUBMITTED','No submitted profile found',404);
  res.json({data:r.rows[0]});
});

tradePortalRouter.post('/trade/relationships', requirePermission('trade:manage'), async(req: any,res: any)=>{
  const parsed=z.object({supplierOrganisationId:uuid}).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:parsed.error.flatten()});
  if(parsed.data.supplierOrganisationId===org(req))return fail(res,'INVALID_PARTNER','Cannot create a relationship with the same organisation');
  const supplier=await pool.query(`SELECT p.organisation_id FROM trade_partner_profiles p
    JOIN organisations o ON o.id=p.organisation_id
    WHERE p.organisation_id=$1 AND p.status='APPROVED' AND o.status='ACTIVE'
      AND o.organisation_type IN ('BRAND','DISTRIBUTOR')`,[parsed.data.supplierOrganisationId]);
  if(!supplier.rowCount)return fail(res,'SUPPLIER_NOT_APPROVED','Supplier organisation is not an approved active trade partner',404);
  const buyer=await pool.query(`SELECT id FROM organisations WHERE id=$1 AND status='ACTIVE' AND organisation_type IN ('RETAILER','BAR_OPERATOR')`,[org(req)]);
  if(!buyer.rowCount)return fail(res,'BUYER_ORGANISATION_REQUIRED','Only active retailer or bar organisations can request trade relationships',403);
  const r=await pool.query(`INSERT INTO trade_relationships(supplier_organisation_id,buyer_organisation_id,requested_by)
    VALUES($1,$2,$3) ON CONFLICT(supplier_organisation_id,buyer_organisation_id)
    DO UPDATE SET status=CASE WHEN trade_relationships.status IN ('REJECTED','SUSPENDED') THEN 'PENDING' ELSE trade_relationships.status END,
    requested_by=EXCLUDED.requested_by,requested_at=NOW() RETURNING *`,
    [parsed.data.supplierOrganisationId,org(req),req.auth!.userId]);
  res.status(201).json({data:r.rows[0]});
});

tradePortalRouter.post('/trade/relationships/:relationshipId/decision', requirePermission('trade:manage'), async(req: any,res: any)=>{
  const parsed=z.object({decision:z.enum(['ACTIVE','REJECTED'])}).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:parsed.error.flatten()});
  const r=await pool.query(`UPDATE trade_relationships SET status=$1,decided_by=$2,decided_at=NOW()
    WHERE id=$3 AND supplier_organisation_id=$4 AND status='PENDING' RETURNING *`,
    [parsed.data.decision,req.auth!.userId,req.params.relationshipId,org(req)]);
  if(!r.rowCount)return fail(res,'RELATIONSHIP_NOT_PENDING','Pending relationship not found for this supplier',404);
  res.json({data:r.rows[0]});
});

tradePortalRouter.get('/trade/relationships', requirePermission('trade:read'), async(req: any,res: any)=>{
  const r=await pool.query(`SELECT tr.*,s.display_name supplier_name,b.display_name buyer_name
    FROM trade_relationships tr JOIN organisations s ON s.id=tr.supplier_organisation_id
    JOIN organisations b ON b.id=tr.buyer_organisation_id
    WHERE tr.supplier_organisation_id=$1 OR tr.buyer_organisation_id=$1
    ORDER BY tr.requested_at DESC`,[org(req)]);
  res.json({data:r.rows});
});

tradePortalRouter.post('/trade/catalogue', requirePermission('trade:manage'), async(req: any,res: any)=>{
  const parsed=z.object({productId:uuid,tradeSku:z.string().trim().max(80).optional(),
    tradePrice:z.number().nonnegative(),minimumOrderQuantity:z.number().positive().default(1)}).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:parsed.error.flatten()});
  const profile=await pool.query("SELECT 1 FROM trade_partner_profiles WHERE organisation_id=$1 AND status='APPROVED'",[org(req)]);
  if(!profile.rowCount)return fail(res,'PARTNER_PROFILE_NOT_APPROVED','Approved brand/distributor profile required',403);
  const product=await pool.query("SELECT id FROM products WHERE id=$1 AND organisation_id=$2 AND status='ACTIVE'",[parsed.data.productId,org(req)]);
  if(!product.rowCount)return fail(res,'PRODUCT_NOT_FOUND','Active product not found in this organisation',404);
  const d=parsed.data;
  const r=await pool.query(`INSERT INTO trade_catalogue_items(supplier_organisation_id,product_id,trade_sku,trade_price,minimum_order_quantity)
    VALUES($1,$2,$3,$4,$5) ON CONFLICT(supplier_organisation_id,product_id)
    DO UPDATE SET trade_sku=EXCLUDED.trade_sku,trade_price=EXCLUDED.trade_price,
      minimum_order_quantity=EXCLUDED.minimum_order_quantity,status='ACTIVE',updated_at=NOW() RETURNING *`,
    [org(req),d.productId,d.tradeSku??null,d.tradePrice,d.minimumOrderQuantity]);
  res.status(201).json({data:r.rows[0]});
});

tradePortalRouter.get('/trade/catalogue', requirePermission('trade:read'), async(req: any,res: any)=>{
  const supplierId=uuid.safeParse(req.query.supplierOrganisationId);
  if(!supplierId.success)return fail(res,'SUPPLIER_REQUIRED','supplierOrganisationId is required');
  const rel=await pool.query("SELECT 1 FROM trade_relationships WHERE supplier_organisation_id=$1 AND buyer_organisation_id=$2 AND status='ACTIVE'",
    [supplierId.data,org(req)]);
  if(!rel.rowCount)return fail(res,'TRADE_RELATIONSHIP_REQUIRED','An active supplier relationship is required',403);
  const r=await pool.query(`SELECT i.id catalogue_item_id,i.trade_sku,i.trade_price,i.minimum_order_quantity,
    p.id product_id,p.sku,p.name,p.pack_size_ml,p.product_type
    FROM trade_catalogue_items i JOIN products p ON p.id=i.product_id
    WHERE i.supplier_organisation_id=$1 AND i.status='ACTIVE' AND p.status='ACTIVE'
    ORDER BY p.name`,[supplierId.data]);
  res.json({data:r.rows});
});

tradePortalRouter.post('/trade/orders', requirePermission('trade:manage'), async(req: any,res: any)=>{
  const parsed=z.object({supplierOrganisationId:uuid,orderNumber:z.string().trim().min(2).max(60),
    notes:z.string().max(1000).optional(),lines:z.array(z.object({catalogueItemId:uuid,quantity:z.number().positive()})).min(1).max(200)}).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:parsed.error.flatten()});
  const d=parsed.data,c=await pool.connect();
  try{
    await c.query('BEGIN');
    const rel=await c.query("SELECT 1 FROM trade_relationships WHERE supplier_organisation_id=$1 AND buyer_organisation_id=$2 AND status='ACTIVE' FOR SHARE",
      [d.supplierOrganisationId,org(req)]);
    if(!rel.rowCount){await c.query('ROLLBACK');return fail(res,'TRADE_RELATIONSHIP_REQUIRED','Active supplier relationship required',403);}
    const ids=d.lines.map((x: any)=>x.catalogueItemId);
    const items=await c.query(`SELECT i.id,i.product_id,i.trade_price,i.minimum_order_quantity
      FROM trade_catalogue_items i JOIN products p ON p.id=i.product_id
      WHERE i.supplier_organisation_id=$1 AND i.id=ANY($2::uuid[]) AND i.status='ACTIVE' AND p.status='ACTIVE' FOR SHARE`,
      [d.supplierOrganisationId,ids]);
    if(items.rowCount!==ids.length){await c.query('ROLLBACK');return fail(res,'CATALOGUE_ITEM_INVALID','One or more catalogue items are unavailable',409);}
    const byId=new Map(items.rows.map((x: any)=>[x.id,x]));
    let subtotalCents=0;
    for(const line of d.lines){const item:any=byId.get(line.catalogueItemId);if(line.quantity<Number(item.minimum_order_quantity)){await c.query('ROLLBACK');return fail(res,'BELOW_MINIMUM_ORDER','Quantity is below supplier minimum order quantity');}subtotalCents+=Math.round(line.quantity*Number(item.trade_price)*100);}
    const order=await c.query(`INSERT INTO trade_orders(order_number,supplier_organisation_id,buyer_organisation_id,status,subtotal,notes,created_by)
      VALUES($1,$2,$3,'SUBMITTED',$4,$5,$6) RETURNING *`,
      [d.orderNumber,d.supplierOrganisationId,org(req),subtotalCents/100,d.notes??null,req.auth!.userId]);
    for(const line of d.lines){const item:any=byId.get(line.catalogueItemId);await c.query(`INSERT INTO trade_order_lines(trade_order_id,product_id,quantity,unit_price,line_total)
      VALUES($1,$2,$3,$4,$5)`,[order.rows[0].id,item.product_id,line.quantity,item.trade_price,Math.round(line.quantity*Number(item.trade_price)*100)/100]);}
    await c.query('COMMIT');res.status(201).json({data:order.rows[0]});
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
});

tradePortalRouter.post('/trade/orders/:orderId/status', requirePermission('trade:manage'), async(req: any,res: any)=>{
  const parsed=z.object({status:z.enum(['ACCEPTED','REJECTED','PROCESSING','DISPATCHED','DELIVERED','CANCELLED'])}).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:parsed.error.flatten()});
  const allowed:any={SUBMITTED:['ACCEPTED','REJECTED','CANCELLED'],ACCEPTED:['PROCESSING','CANCELLED'],PROCESSING:['DISPATCHED','CANCELLED'],DISPATCHED:['DELIVERED']};
  const c=await pool.connect();
  try{
    await c.query('BEGIN');
    const q=await c.query('SELECT * FROM trade_orders WHERE id=$1 AND (supplier_organisation_id=$2 OR buyer_organisation_id=$2) FOR UPDATE',[req.params.orderId,org(req)]);
    if(!q.rowCount){await c.query('ROLLBACK');return fail(res,'TRADE_ORDER_NOT_FOUND','Trade order not found',404);}
    const order=q.rows[0],next=parsed.data.status;
    if(!(allowed[order.status]||[]).includes(next)){await c.query('ROLLBACK');return fail(res,'INVALID_TRADE_ORDER_TRANSITION',`Cannot transition ${order.status} to ${next}`,409);}
    if(['ACCEPTED','REJECTED','PROCESSING','DISPATCHED','DELIVERED'].includes(next)&&order.supplier_organisation_id!==org(req)){await c.query('ROLLBACK');return fail(res,'SUPPLIER_ACTION_REQUIRED','Only supplier can perform this transition',403);}
    if(next==='CANCELLED'&&order.buyer_organisation_id!==org(req)){await c.query('ROLLBACK');return fail(res,'BUYER_ACTION_REQUIRED','Only buyer can cancel this order',403);}
    const updated=await c.query('UPDATE trade_orders SET status=$1,decided_by=$2,updated_at=NOW() WHERE id=$3 RETURNING *',[next,req.auth!.userId,order.id]);
    await c.query('COMMIT');res.json({data:updated.rows[0]});
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
});

tradePortalRouter.get('/trade/orders', requirePermission('trade:read'), async(req: any,res: any)=>{
  const r=await pool.query(`SELECT t.*,s.display_name supplier_name,b.display_name buyer_name
    FROM trade_orders t JOIN organisations s ON s.id=t.supplier_organisation_id
    JOIN organisations b ON b.id=t.buyer_organisation_id
    WHERE t.supplier_organisation_id=$1 OR t.buyer_organisation_id=$1
    ORDER BY t.created_at DESC LIMIT 200`,[org(req)]);
  res.json({data:r.rows});
});


// P537 append-only dispatch and receipt evidence. A buyer receipt is evidence only;
// inventory receipt/GRN and accounting posting remain separate controlled workflows.
tradePortalRouter.post('/trade/orders/:orderId/fulfilment-evidence', requirePermission('trade:manage'), async (req: any, res: any) => {
  const parsed = z.object({
    eventType: z.enum(['DISPATCH_NOTE','CARRIER_HANDOFF','DELIVERY_ATTEMPT','BUYER_RECEIPT','RECEIPT_EXCEPTION']),
    referenceNumber: z.string().trim().max(120).optional(),
    quantityReceived: z.number().nonnegative().optional(),
    notes: z.string().max(2000).optional(),
    evidenceUri: z.string().url().max(1000).optional()
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const order = await pool.query(`SELECT id,supplier_organisation_id,buyer_organisation_id,status
    FROM trade_orders WHERE id=$1 AND (supplier_organisation_id=$2 OR buyer_organisation_id=$2)`, [req.params.orderId, org(req)]);
  if (!order.rowCount) return fail(res, 'TRADE_ORDER_NOT_FOUND', 'Trade order not found', 404);
  const d = parsed.data, row = order.rows[0];
  const supplierEvents = ['DISPATCH_NOTE','CARRIER_HANDOFF','DELIVERY_ATTEMPT'];
  if (supplierEvents.includes(d.eventType) && row.supplier_organisation_id !== org(req))
    return fail(res, 'SUPPLIER_ACTION_REQUIRED', 'Only the supplier can submit dispatch evidence', 403);
  if (['BUYER_RECEIPT','RECEIPT_EXCEPTION'].includes(d.eventType) && row.buyer_organisation_id !== org(req))
    return fail(res, 'BUYER_ACTION_REQUIRED', 'Only the buyer can submit receipt evidence', 403);
  if (d.eventType === 'BUYER_RECEIPT' && row.status !== 'DISPATCHED')
    return fail(res, 'ORDER_NOT_DISPATCHED', 'Buyer receipt evidence requires a dispatched order', 409);
  const result = await pool.query(`INSERT INTO trade_order_fulfilment_events
    (trade_order_id,organisation_id,event_type,reference_number,quantity_received,notes,evidence_uri,created_by)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [row.id, org(req), d.eventType, d.referenceNumber ?? null, d.quantityReceived ?? null,
      d.notes ?? null, d.evidenceUri ?? null, req.auth!.userId]);
  res.status(201).json({ data: result.rows[0] });
});

tradePortalRouter.get('/trade/orders/:orderId/fulfilment-evidence', requirePermission('trade:read'), async (req: any, res: any) => {
  const access = await pool.query('SELECT 1 FROM trade_orders WHERE id=$1 AND (supplier_organisation_id=$2 OR buyer_organisation_id=$2)', [req.params.orderId, org(req)]);
  if (!access.rowCount) return fail(res, 'TRADE_ORDER_NOT_FOUND', 'Trade order not found', 404);
  const result = await pool.query(`SELECT id,event_type,reference_number,quantity_received,notes,evidence_uri,created_at
    FROM trade_order_fulfilment_events WHERE trade_order_id=$1 ORDER BY created_at,id`, [req.params.orderId]);
  res.json({ data: result.rows });
});
