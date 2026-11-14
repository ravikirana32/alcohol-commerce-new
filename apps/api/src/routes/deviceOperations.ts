import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireOrgScope } from '../middleware/requireOrgScope.js';
import { requirePermission } from '../middleware/requirePermission.js';

export const deviceOperationsRouter = Router();
deviceOperationsRouter.use(authenticate, requireOrgScope);
const org=(req:any)=>req.auth.organisationId as string;
const uuid=z.string().uuid();
const fail=(res:any,code:string,message:string,status=400)=>res.status(status).json({error:{code,message}});

deviceOperationsRouter.post('/devices/:deviceId/health',requirePermission('device:manage'),async(req:any,res:any)=>{
 if(!uuid.safeParse(req.params.deviceId).success)return fail(res,'INVALID_DEVICE_ID','Invalid device ID');
 const p=z.object({outletId:uuid,healthStatus:z.enum(['HEALTHY','DEGRADED','UNHEALTHY']),appVersion:z.string().trim().min(1).max(80),platformVersion:z.string().trim().max(80).optional(),batteryPercent:z.number().int().min(0).max(100).optional(),storageFreeBytes:z.number().int().nonnegative().safe().optional(),queueDepth:z.number().int().min(0).max(1000000),lastLocalEventAt:z.string().datetime().optional()}).safeParse(req.body);
 if(!p.success)return res.status(400).json({error:p.error.flatten()}); const d=p.data;
 const c=await pool.connect();try{await c.query('BEGIN');
 const device=await c.query("SELECT id,status FROM pos_devices WHERE id=$1 AND organisation_id=$2 FOR UPDATE",[req.params.deviceId,org(req)]);
 const outlet=await c.query('SELECT id FROM outlets WHERE id=$1 AND organisation_id=$2',[d.outletId,org(req)]);
 if(!device.rowCount||!outlet.rowCount){await c.query('ROLLBACK');return fail(res,'DEVICE_OR_OUTLET_NOT_FOUND','Device or outlet is not in this organisation',404);}
 if(device.rows[0].status!=='TRUSTED'){await c.query('ROLLBACK');return fail(res,'DEVICE_NOT_TRUSTED','Only cryptographically trusted devices may report operational health',403);}
 const r=await c.query(`INSERT INTO p580_device_health_events(organisation_id,device_id,outlet_id,health_status,app_version,platform_version,battery_percent,storage_free_bytes,queue_depth,last_local_event_at,reported_by)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id,health_status,reported_at`,[org(req),req.params.deviceId,d.outletId,d.healthStatus,d.appVersion,d.platformVersion??null,d.batteryPercent??null,d.storageFreeBytes??null,d.queueDepth,d.lastLocalEventAt??null,req.auth.userId]);
 await c.query('UPDATE pos_devices SET last_seen_at=NOW(),updated_at=NOW() WHERE id=$1',[req.params.deviceId]);await c.query('COMMIT');res.status(201).json({data:r.rows[0]});
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
});
deviceOperationsRouter.get('/devices/health',requirePermission('device:health:read'),async(req:any,res:any)=>{
 const p=z.object({outletId:uuid.optional(),deviceId:uuid.optional()}).safeParse(req.query);if(!p.success)return res.status(400).json({error:p.error.flatten()});
 const v:any[]=[org(req)];let w='h.organisation_id=$1';if(p.data.outletId){v.push(p.data.outletId);w+=` AND h.outlet_id=$${v.length}`;}if(p.data.deviceId){v.push(p.data.deviceId);w+=` AND h.device_id=$${v.length}`;}
 const r=await pool.query(`SELECT DISTINCT ON(h.device_id) h.device_id,d.device_name,h.outlet_id,h.health_status,h.app_version,h.platform_version,h.battery_percent,h.storage_free_bytes,h.queue_depth,h.last_local_event_at,h.reported_at FROM p580_device_health_events h JOIN pos_devices d ON d.id=h.device_id WHERE ${w} ORDER BY h.device_id,h.reported_at DESC LIMIT 250`,v);res.json({data:r.rows});
});
deviceOperationsRouter.get('/offline/checkpoints',requirePermission('offline:checkpoint:read'),async(req:any,res:any)=>{
 const p=z.object({outletId:uuid.optional()}).safeParse(req.query);if(!p.success)return res.status(400).json({error:p.error.flatten()});const v:any[]=[org(req)];let w='c.organisation_id=$1';if(p.data.outletId){v.push(p.data.outletId);w+=` AND c.outlet_id=$${v.length}`;}
 const r=await pool.query(`SELECT c.device_id,d.label,d.status,c.outlet_id,c.max_seen_sequence,c.last_batch_id,c.updated_at FROM p580_offline_sync_checkpoints c JOIN offline_sync_devices d ON d.id=c.device_id WHERE ${w} ORDER BY c.updated_at DESC`,v);res.json({data:r.rows,financialPosting:'DISABLED'});
});
