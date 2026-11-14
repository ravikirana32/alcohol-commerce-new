import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireOrgScope } from '../middleware/requireOrgScope.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { assessProviderEvent } from '../services/providerAdapter.js';

export const enterpriseIntegrationsRouter = Router();
enterpriseIntegrationsRouter.use(authenticate, requireOrgScope);
const org = (req: any) => req.auth.organisationId as string;
const fail = (res: any, code: string, message: string, status = 400) => res.status(status).json({ error: { code, message } });
const uuid = z.string().uuid();
const provider = z.enum(['ACCOUNTING_EXPORT','ERP','DELIVERY','CRM','DATA_WAREHOUSE','CUSTOM']);
const envRef = z.string().regex(/^[A-Z][A-Z0-9_]{2,100}$/);
const audit = async (req:any, eventCode:string, resourceId:string, metadata:Record<string,unknown> = {}) => {
  await pool.query(`INSERT INTO security_audit_events(organisation_id,actor_user_id,event_code,resource_type,resource_id,outcome,request_id,source_ip,metadata)
    VALUES($1,$2,$3,'ENTERPRISE_INTEGRATION',$4,'SUCCESS',$5,$6::inet,$7::jsonb)`,
    [org(req),req.auth.userId,eventCode,resourceId,req.header('x-request-id') ?? null,req.ip ?? null,JSON.stringify(metadata)]);
};

enterpriseIntegrationsRouter.get('/enterprise-integrations', requirePermission('integration:read'), async (req:any,res:any) => {
  const r = await pool.query(`SELECT id,provider_code,display_name,status,endpoint_url,credential_env_ref,config,created_at,updated_at
    FROM enterprise_integrations WHERE organisation_id=$1 ORDER BY created_at DESC`, [org(req)]);
  res.json({ data:r.rows });
});

enterpriseIntegrationsRouter.post('/enterprise-integrations', requirePermission('integration:manage'), async (req:any,res:any) => {
  const p = z.object({ providerCode:provider, displayName:z.string().trim().min(2).max(120),
    endpointUrl:z.string().url().refine(v => v.startsWith('https://'),'HTTPS endpoint required').optional(),
    credentialEnvRef:envRef.optional(), config:z.record(z.unknown()).default({}) }).safeParse(req.body);
  if(!p.success) return res.status(400).json({error:p.error.flatten()});
  const d=p.data;
  const r=await pool.query(`INSERT INTO enterprise_integrations(organisation_id,provider_code,display_name,status,endpoint_url,credential_env_ref,config,created_by)
    VALUES($1,$2,$3,'DRAFT',$4,$5,$6,$7) RETURNING id,provider_code,display_name,status,endpoint_url,credential_env_ref,config,created_at`,
    [org(req),d.providerCode,d.displayName,d.endpointUrl??null,d.credentialEnvRef??null,d.config,req.auth.userId]);
  await audit(req,'INTEGRATION_CREATED',r.rows[0].id,{providerCode:d.providerCode});
  res.status(201).json({data:r.rows[0]});
});

enterpriseIntegrationsRouter.post('/enterprise-integrations/:integrationId/configure', requirePermission('integration:manage'), async(req:any,res:any)=>{
  if(!uuid.safeParse(req.params.integrationId).success) return fail(res,'INVALID_INTEGRATION_ID','Invalid integration id');
  const p=z.object({endpointUrl:z.string().url().refine(v=>v.startsWith('https://'),'HTTPS endpoint required'),credentialEnvRef:envRef,config:z.record(z.unknown()).default({})}).safeParse(req.body);
  if(!p.success)return res.status(400).json({error:p.error.flatten()});
  const r=await pool.query(`UPDATE enterprise_integrations SET endpoint_url=$1,credential_env_ref=$2,config=$3,status='CONFIGURED',updated_at=NOW()
    WHERE id=$4 AND organisation_id=$5 AND status IN ('DRAFT','CONFIGURED','PAUSED')
    RETURNING id,provider_code,display_name,status,endpoint_url,credential_env_ref,config,updated_at`,
    [p.data.endpointUrl,p.data.credentialEnvRef,p.data.config,req.params.integrationId,org(req)]);
  if(!r.rowCount)return fail(res,'INTEGRATION_NOT_FOUND','Integration not found or revoked',404);
  await audit(req,'INTEGRATION_CONFIGURED',r.rows[0].id,{credentialReferenceChanged:true});
  res.json({data:r.rows[0]});
});

enterpriseIntegrationsRouter.post('/enterprise-integrations/:integrationId/status', requirePermission('integration:manage'), async(req:any,res:any)=>{
  if(!uuid.safeParse(req.params.integrationId).success)return fail(res,'INVALID_INTEGRATION_ID','Invalid integration id');
  const p=z.object({status:z.enum(['PAUSED','REVOKED'])}).safeParse(req.body);
  if(!p.success)return res.status(400).json({error:p.error.flatten()});
  const r=await pool.query(`UPDATE enterprise_integrations SET status=$1,updated_at=NOW() WHERE id=$2 AND organisation_id=$3 AND status<>'REVOKED'
    RETURNING id,status,updated_at`,[p.data.status,req.params.integrationId,org(req)]);
  if(!r.rowCount)return fail(res,'INTEGRATION_NOT_FOUND','Integration not found',404);
  if(p.data.status==='REVOKED') await pool.query(`UPDATE integration_outbox_events SET status='CANCELLED' WHERE integration_id=$1 AND organisation_id=$2 AND status IN ('QUEUED','HELD','FAILED')`,[req.params.integrationId,org(req)]);
  if(p.data.status==='PAUSED') await pool.query(`UPDATE integration_outbox_events SET status='HELD' WHERE integration_id=$1 AND organisation_id=$2 AND status='QUEUED'`,[req.params.integrationId,org(req)]);
  await audit(req,p.data.status==='REVOKED'?'INTEGRATION_REVOKED':'INTEGRATION_PAUSED',r.rows[0].id);
  res.json({data:r.rows[0]});
});

enterpriseIntegrationsRouter.get('/enterprise-integrations/:integrationId/events', requirePermission('integration:read'), async(req:any,res:any)=>{
  if(!uuid.safeParse(req.params.integrationId).success)return fail(res,'INVALID_INTEGRATION_ID','Invalid integration id');
  const r=await pool.query(`SELECT e.id,e.event_type,e.idempotency_key,e.status,e.attempt_count,e.next_attempt_at,e.delivered_at,e.created_at,
      (SELECT COUNT(*)::int FROM integration_delivery_attempts a WHERE a.event_id=e.id) AS delivery_attempts
    FROM integration_outbox_events e JOIN enterprise_integrations i ON i.id=e.integration_id
    WHERE e.integration_id=$1 AND e.organisation_id=$2 ORDER BY e.created_at DESC LIMIT 200`,[req.params.integrationId,org(req)]);
  res.json({data:r.rows,deliveryEnabled:false,note:'Outbound dispatch remains disabled until provider-specific certification and SSRF-safe egress controls are approved.'});
});

// P582 adapter contract assessment. This is a dry-run certification check only;
// no network request or provider dispatch is performed by this endpoint.
enterpriseIntegrationsRouter.post('/enterprise-integrations/:integrationId/adapter-assess',requirePermission('integration:manage'),async(req:any,res:any)=>{
 if(!uuid.safeParse(req.params.integrationId).success)return fail(res,'INVALID_INTEGRATION_ID','Invalid integration id');
 const p=z.object({eventType:z.string().trim().min(1).max(100),payload:z.record(z.unknown()),idempotencyKey:z.string().min(1).max(200)}).safeParse(req.body);
 if(!p.success)return res.status(400).json({error:p.error.flatten()});
 const q=await pool.query(`SELECT id,provider_code,endpoint_url,status FROM enterprise_integrations WHERE id=$1 AND organisation_id=$2`,[req.params.integrationId,org(req)]);
 if(!q.rowCount)return fail(res,'INTEGRATION_NOT_FOUND','Integration not found',404);
 const i=q.rows[0];
 if(!i.endpoint_url)return fail(res,'ENDPOINT_NOT_CONFIGURED','Configure an HTTPS endpoint before adapter assessment',409);
 const assessment=assessProviderEvent({provider:i.provider_code,eventType:p.data.eventType,payload:p.data.payload,idempotencyKey:p.data.idempotencyKey,endpointUrl:i.endpoint_url});
 const saved=await pool.query(`INSERT INTO p582_provider_certification_runs(organisation_id,integration_id,event_type,payload_hash,idempotency_key,endpoint_host,accepted,rejection_reasons,assessed_by)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9) RETURNING id,assessed_at`,
 [org(req),i.id,p.data.eventType,assessment.payloadHash,assessment.idempotencyKey,assessment.endpointHost,assessment.accepted,JSON.stringify(assessment.reasons),req.auth.userId]);
 await audit(req,'PROVIDER_ADAPTER_ASSESSED',i.id,{accepted:assessment.accepted,reasons:assessment.reasons});
 res.json({data:{...assessment,certificationRun:saved.rows[0],integrationStatus:i.status},dispatchEnabled:false});
});
enterpriseIntegrationsRouter.get('/enterprise-integrations/:integrationId/adapter-assessments',requirePermission('integration:read'),async(req:any,res:any)=>{
 if(!uuid.safeParse(req.params.integrationId).success)return fail(res,'INVALID_INTEGRATION_ID','Invalid integration id');
 const r=await pool.query(`SELECT id,event_type,payload_hash,endpoint_host,accepted,rejection_reasons,dispatch_allowed,assessed_at FROM p582_provider_certification_runs WHERE integration_id=$1 AND organisation_id=$2 ORDER BY assessed_at DESC LIMIT 100`,[req.params.integrationId,org(req)]);
 res.json({data:r.rows,dispatchEnabled:false});
});
