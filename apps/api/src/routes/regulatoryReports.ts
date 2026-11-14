import { Router } from 'express';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireOrgScope } from '../middleware/requireOrgScope.js';
import { requirePermission } from '../middleware/requirePermission.js';

export const regulatoryReportsRouter = Router();
regulatoryReportsRouter.use(authenticate, requireOrgScope);
const org = (req: any) => req.auth.organisationId as string;
const uuid = z.string().uuid();
const fail = (res: any, code: string, message: string, status = 400) => res.status(status).json({ error: { code, message } });

regulatoryReportsRouter.get('/compliance/reports', requirePermission('compliance:reports:read'), async (req: any, res: any) => {
 const p = z.object({ from:z.string().date(), to:z.string().date(), outletId:uuid.optional(), type:z.enum(['EXCISE_DECISIONS','LICENCE_STATUS','DRY_DAY_ORDERS','COMPLIANCE_EXCEPTIONS']) }).refine(v=>v.to>=v.from).safeParse(req.query);
 if(!p.success) return res.status(400).json({error:p.error.flatten()});
 const {from,to,outletId,type}=p.data; if(outletId){const owned=await pool.query('SELECT 1 FROM outlets WHERE id=$1 AND organisation_id=$2',[outletId,org(req)]);if(!owned.rowCount)return fail(res,'OUTLET_NOT_FOUND','Outlet is not part of this organisation',404);} const values:any[]=[org(req),from,to]; let outletClause='';
 if(outletId && type!=='DRY_DAY_ORDERS'){ values.push(outletId); outletClause=` AND outlet_id=$${values.length}`; }
 let sql='';
 if(type==='EXCISE_DECISIONS') sql=`SELECT id,outlet_id,channel,outcome,reason_codes,transaction_occurred_at,source_type,source_reference,evidence FROM excise_compliance_decisions WHERE organisation_id=$1 AND transaction_occurred_at >= $2::date AND transaction_occurred_at < ($3::date + INTERVAL '1 day')${outletClause} ORDER BY transaction_occurred_at,id`;
 if(type==='LICENCE_STATUS') sql=`SELECT id,outlet_id,licence_type,jurisdiction_code,status,valid_from,valid_until,permitted_activities FROM outlet_licences WHERE organisation_id=$1 AND (valid_until IS NULL OR valid_until >= $2::date) AND (valid_from IS NULL OR valid_from <= $3::date)${outletClause} ORDER BY outlet_id,licence_type`;
 if(type==='DRY_DAY_ORDERS') sql=`SELECT d.id,d.jurisdiction_code,d.district,d.dry_day_date,d.order_reference,d.reason,d.status FROM excise_dry_day_orders d WHERE d.jurisdiction_code IN (SELECT DISTINCT state_code FROM outlets WHERE organisation_id=$1) AND d.dry_day_date BETWEEN $2::date AND $3::date AND ($4::uuid IS NULL OR EXISTS (SELECT 1 FROM outlets o WHERE o.id=$4 AND o.organisation_id=$1 AND o.state_code=d.jurisdiction_code AND (d.district IS NULL OR lower(d.district)=lower(o.district)))) ORDER BY d.dry_day_date`;
 if(type==='COMPLIANCE_EXCEPTIONS') sql=`SELECT id,outlet_id,channel,outcome,reason_codes,transaction_occurred_at,source_type,source_reference FROM excise_compliance_decisions WHERE organisation_id=$1 AND outcome='DENY' AND transaction_occurred_at >= $2::date AND transaction_occurred_at < ($3::date + INTERVAL '1 day')${outletClause} ORDER BY transaction_occurred_at,id`;
 if(type==='DRY_DAY_ORDERS') values.push(outletId??null);
 const result=await pool.query(sql,values); const reportData=result.rows;
 const hash=createHash('sha256').update(JSON.stringify(reportData)).digest('hex');
 const saved=await pool.query(`INSERT INTO p579_regulatory_report_runs(organisation_id,outlet_id,report_type,period_from,period_to,generated_by,row_count,report_hash,report_data) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) RETURNING id,created_at,row_count,report_hash`,[org(req),outletId??null,type,from,to,req.auth.userId,reportData.length,hash,JSON.stringify(reportData)]);
 res.json({data:{run:saved.rows[0],rows:reportData,format:'JSON',immutableEvidence:true}});
});
regulatoryReportsRouter.get('/compliance/reports/history', requirePermission('compliance:reports:read'), async(req:any,res:any)=>{
 const r=await pool.query(`SELECT id,outlet_id,report_type,period_from,period_to,row_count,report_hash,created_at FROM p579_regulatory_report_runs WHERE organisation_id=$1 ORDER BY created_at DESC LIMIT 100`,[org(req)]); res.json({data:r.rows});
});
regulatoryReportsRouter.post('/compliance/traceability', requirePermission('compliance:traceability:manage'), async(req:any,res:any)=>{
 const p=z.object({outletId:uuid,productId:uuid,stockMovementId:uuid,lotReference:z.string().trim().min(1).max(120),supplierReference:z.string().trim().max(160).optional(),manufactureDate:z.string().date().optional(),expiryDate:z.string().date().optional(),receivedQuantity:z.number().positive().max(100000000)}).refine(v=>!v.manufactureDate||!v.expiryDate||v.expiryDate>=v.manufactureDate).safeParse(req.body);
 if(!p.success)return res.status(400).json({error:p.error.flatten()}); const d=p.data;
 const r=await pool.query(`INSERT INTO p579_product_traceability_links(organisation_id,outlet_id,product_id,stock_movement_id,lot_reference,supplier_reference,manufacture_date,expiry_date,received_quantity,created_by) SELECT $1,o.id,p.id,m.id,$5,$6,$7,$8,$9,$10 FROM outlets o JOIN products p ON p.id=$3 AND p.organisation_id=$1 JOIN stock_movements m ON m.id=$4 AND m.organisation_id=$1 AND m.outlet_id=o.id AND m.product_id=p.id AND m.movement_type IN ('RECEIPT','TRANSFER_IN','RETURN') AND m.quantity_units >= $9 WHERE o.id=$2 AND o.organisation_id=$1 ON CONFLICT(organisation_id,stock_movement_id,lot_reference) DO NOTHING RETURNING *`,[org(req),d.outletId,d.productId,d.stockMovementId,d.lotReference,d.supplierReference??null,d.manufactureDate??null,d.expiryDate??null,d.receivedQuantity,req.auth.userId]);
 if(!r.rowCount)return fail(res,'TRACEABILITY_SOURCE_MISMATCH','Product, outlet and stock movement mismatch or duplicate lot reference; source must be an inbound movement for this product and outlet with sufficient quantity',409); res.status(201).json({data:r.rows[0]});
});
regulatoryReportsRouter.get('/compliance/traceability', requirePermission('compliance:reports:read'), async(req:any,res:any)=>{
 const p=z.object({outletId:uuid.optional(),productId:uuid.optional(),lotReference:z.string().trim().max(120).optional(),expiringWithinDays:z.coerce.number().int().min(0).max(365).optional()}).safeParse(req.query); if(!p.success)return res.status(400).json({error:p.error.flatten()});
 const v:any[]=[org(req)];let w='t.organisation_id=$1'; for(const [field,col] of [['outletId','outlet_id'],['productId','product_id'],['lotReference','lot_reference']] as const){const value=(p.data as any)[field];if(value){v.push(value);w+=` AND t.${col}=$${v.length}`;}}
 if(p.data.expiringWithinDays!==undefined){v.push(p.data.expiringWithinDays);w+=` AND t.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + $${v.length}::int`;}
 const r=await pool.query(`SELECT t.*,p.name AS product_name FROM p579_product_traceability_links t JOIN products p ON p.id=t.product_id WHERE ${w} ORDER BY t.expiry_date NULLS LAST,t.created_at DESC LIMIT 500`,v); res.json({data:r.rows});
});
