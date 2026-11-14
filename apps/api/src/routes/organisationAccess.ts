import { Router } from 'express';
import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireOrgScope } from '../middleware/requireOrgScope.js';
import { requirePermission } from '../middleware/requirePermission.js';

export const organisationAccessRouter = Router();
export const invitationAcceptanceRouter = Router();
organisationAccessRouter.use(authenticate, requireOrgScope);

const uuid = z.string().uuid();
const fail = (res: any, code: string, message: string, status = 400) => res.status(status).json({ error: { code, message } });
const orgId = (req: any) => req.auth.organisationId as string | null;
const roles = ['RETAIL_OWNER','RETAIL_MANAGER','CASHIER','BAR_OWNER','BAR_MANAGER','BARTENDER','BRAND_ADMIN','BRAND_ANALYST','DISTRIBUTOR_ADMIN','SALES_REP','AUDITOR'] as const;

organisationAccessRouter.get('/organisation/current', requirePermission('organisation:read'), async (req, res) => {
  if (!orgId(req)) return fail(res, 'ORG_CONTEXT_REQUIRED', 'Select an organisation to continue', 409);
  const result = await pool.query(`SELECT id,name,legal_name,display_name,organisation_type,organisation_profile,gstin,country_code,status,created_at,updated_at
    FROM organisations WHERE id=$1`, [orgId(req)]);
  if (!result.rowCount) return fail(res, 'ORGANISATION_NOT_FOUND', 'Organisation not found', 404);
  return res.json({ data: result.rows[0] });
});

organisationAccessRouter.patch('/organisation/current', requirePermission('organisation:manage'), async (req, res) => {
  const parsed = z.object({ name:z.string().trim().min(2).max(160).optional(), legalName:z.string().trim().min(2).max(200).optional(), gstin:z.string().trim().max(20).nullable().optional(), profile:z.enum(['RETAIL_ONLY','BAR_ONLY','HYBRID']).optional() }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error:{code:'VALIDATION_ERROR',details:parsed.error.flatten()} });
  if (!orgId(req)) return fail(res,'ORG_CONTEXT_REQUIRED','Select an organisation to continue',409);
  const d=parsed.data;
  const result=await pool.query(`UPDATE organisations SET name=COALESCE($1,name),display_name=COALESCE($1,display_name),legal_name=COALESCE($2,legal_name),gstin=CASE WHEN $3::boolean THEN $4 ELSE gstin END,organisation_profile=COALESCE($5,organisation_profile),updated_at=NOW() WHERE id=$6 RETURNING id,name,legal_name,organisation_type,organisation_profile,gstin,status,updated_at`,[d.name??null,d.legalName??null,Object.hasOwn(d,'gstin'),d.gstin??null,d.profile??null,orgId(req)]);
  if(!result.rowCount)return fail(res,'ORGANISATION_NOT_FOUND','Organisation not found',404);
  await pool.query(`INSERT INTO audit_events(organisation_id,actor_user_id,event_type,entity_type,entity_id,metadata) VALUES($1,$2,'ORGANISATION_UPDATED','ORGANISATION',$1,$3)`,[orgId(req),req.auth!.userId,d]);
  return res.json({data:result.rows[0]});
});

organisationAccessRouter.get('/organisation/members', requirePermission('user:read'), async (req,res)=>{
  if(!orgId(req))return fail(res,'ORG_CONTEXT_REQUIRED','Select an organisation to continue',409);
  const result=await pool.query(`SELECT u.id,u.email,u.display_name,u.status,m.role_code,m.status AS membership_status,m.created_at,
      COALESCE((SELECT json_agg(ua.outlet_id ORDER BY ua.outlet_id) FROM user_outlet_access ua JOIN outlets o ON o.id=ua.outlet_id WHERE ua.user_id=u.id AND o.organisation_id=m.organisation_id),'[]'::json) AS outlet_ids
    FROM organisation_memberships m JOIN users u ON u.id=m.user_id WHERE m.organisation_id=$1 ORDER BY m.created_at DESC`,[orgId(req)]);
  return res.json({data:result.rows});
});

organisationAccessRouter.post('/organisation/invitations', requirePermission('user:manage'), async (req,res)=>{
  const parsed=z.object({email:z.string().email().max(254).transform(v=>v.toLowerCase()),displayName:z.string().trim().min(2).max(100),roleCode:z.enum(roles),expiresInHours:z.number().int().min(1).max(168).default(72)}).strict().safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:parsed.error.flatten()}});
  if(!orgId(req))return fail(res,'ORG_CONTEXT_REQUIRED','Select an organisation to continue',409);
  if(['RETAIL_OWNER','BAR_OWNER'].includes(parsed.data.roleCode))return fail(res,'OWNER_ROLE_REQUIRES_PLATFORM_PROVISIONING','Owner roles must be provisioned by a platform administrator',403);
  const user=await pool.query('SELECT id FROM users WHERE email=$1',[parsed.data.email]);
  if(user.rowCount){
    const membership=await pool.query("SELECT 1 FROM organisation_memberships WHERE user_id=$1 AND organisation_id=$2 AND status IN ('ACTIVE','INVITED')",[user.rows[0].id,orgId(req)]);
    if(membership.rowCount)return fail(res,'MEMBERSHIP_EXISTS','This user already has an active or pending membership',409);
  }
  const token=randomBytes(32).toString('base64url');
  const tokenHash=createHash('sha256').update(token).digest('hex');
  const expiresAt=new Date(Date.now()+parsed.data.expiresInHours*3600000);
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    await client.query("UPDATE organisation_invitations SET status='EXPIRED' WHERE organisation_id=$1 AND email=$2 AND status='PENDING'",[orgId(req),parsed.data.email]);
    const invite=await client.query(`INSERT INTO organisation_invitations(organisation_id,email,display_name,role_code,token_hash,expires_at,invited_by)
      VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,email,display_name,role_code,status,expires_at`,[orgId(req),parsed.data.email,parsed.data.displayName,parsed.data.roleCode,tokenHash,expiresAt,req.auth!.userId]);
    await client.query(`INSERT INTO audit_events(organisation_id,actor_user_id,event_type,entity_type,entity_id,metadata) VALUES($1,$2,'USER_INVITED','ORGANISATION_INVITATION',$3,$4)`,[orgId(req),req.auth!.userId,invite.rows[0].id,{email:parsed.data.email,roleCode:parsed.data.roleCode}]);
    await client.query('COMMIT');
    return res.status(201).json({data:{...invite.rows[0],invitationToken:token,delivery:'TOKEN_RETURNED_ONCE_FOR_CONFIGURED_DELIVERY'}});
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
});

invitationAcceptanceRouter.post('/organisation/invitations/accept', async (req,res)=>{
  const parsed=z.object({token:z.string().min(32).max(128),password:z.string().min(12).max(128)}).strict().safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:parsed.error.flatten()}});
  const tokenHash=createHash('sha256').update(parsed.data.token).digest('hex');
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const invitation=await client.query(`SELECT * FROM organisation_invitations WHERE token_hash=$1 FOR UPDATE`,[tokenHash]);
    const invite=invitation.rows[0];
    if(!invite||invite.status!=='PENDING'){await client.query('ROLLBACK');return fail(res,'INVITATION_INVALID','Invitation is invalid, used or revoked',410);}
    if(new Date(invite.expires_at).getTime()<=Date.now()){
      await client.query("UPDATE organisation_invitations SET status='EXPIRED' WHERE id=$1",[invite.id]);await client.query('COMMIT');return fail(res,'INVITATION_EXPIRED','Invitation has expired',410);
    }
    const existing=await client.query('SELECT id FROM users WHERE email=$1 FOR UPDATE',[invite.email]);
    let userId:string;
    if(existing.rowCount){
      userId=existing.rows[0].id;
      const account=await client.query("SELECT status,password_hash FROM users WHERE id=$1",[userId]);
      if(account.rows[0].status!=='ACTIVE'){await client.query('ROLLBACK');return fail(res,'USER_NOT_ACTIVE','Existing account is not active; contact an administrator',403);}
      if(!(await bcrypt.compare(parsed.data.password,account.rows[0].password_hash))){await client.query('ROLLBACK');return fail(res,'ACCOUNT_PASSWORD_INVALID','Enter the existing account password to accept this invitation',403);}
    }else{
      const hash=await bcrypt.hash(parsed.data.password,12);
      const created=await client.query(`INSERT INTO users(email,display_name,password_hash,status) VALUES($1,$2,$3,'ACTIVE') RETURNING id`,[invite.email,invite.display_name,hash]);
      userId=created.rows[0].id;
    }
    await client.query(`INSERT INTO organisation_memberships(user_id,organisation_id,role_code,status) VALUES($1,$2,$3,'ACTIVE') ON CONFLICT(user_id,organisation_id) DO UPDATE SET role_code=EXCLUDED.role_code,status='ACTIVE'`,[userId,invite.organisation_id,invite.role_code]);
    await client.query("UPDATE organisation_invitations SET status='ACCEPTED',accepted_by=$1,accepted_at=NOW() WHERE id=$2",[userId,invite.id]);
    await client.query(`INSERT INTO audit_events(organisation_id,actor_user_id,event_type,entity_type,entity_id,metadata) VALUES($1,$2,'USER_INVITATION_ACCEPTED','USER',$2,$3)`,[invite.organisation_id,userId,{invitationId:invite.id,roleCode:invite.role_code}]);
    await client.query('COMMIT');
    return res.status(201).json({data:{userId,organisationId:invite.organisation_id,roleCode:invite.role_code,status:'ACTIVE'},message:'Invitation accepted. Sign in to continue.'});
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
});

organisationAccessRouter.patch('/organisation/members/:userId', requirePermission('user:manage'), async(req,res)=>{
  const parsed=z.object({roleCode:z.enum(roles).optional(),status:z.enum(['ACTIVE','SUSPENDED','REVOKED']).optional()}).strict().refine(v=>Object.keys(v).length>0).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:parsed.error.flatten()}});
  if(!orgId(req))return fail(res,'ORG_CONTEXT_REQUIRED','Select an organisation to continue',409);
  if(req.params.userId===req.auth!.userId)return fail(res,'SELF_MEMBERSHIP_CHANGE_DENIED','You cannot change your own organisation membership',403);
  const d=parsed.data;
  if(d.roleCode&&['RETAIL_OWNER','BAR_OWNER'].includes(d.roleCode)&&!req.auth!.isPlatformAdmin)return fail(res,'OWNER_ROLE_REQUIRES_PLATFORM_PROVISIONING','Owner roles must be provisioned by a platform administrator',403);
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const current=await client.query('SELECT role_code,status FROM organisation_memberships WHERE user_id=$1 AND organisation_id=$2 FOR UPDATE',[req.params.userId,orgId(req)]);
    if(!current.rowCount){await client.query('ROLLBACK');return fail(res,'MEMBERSHIP_NOT_FOUND','Organisation membership not found',404);}
    const removesOwner=['RETAIL_OWNER','BAR_OWNER'].includes(current.rows[0].role_code)&&((d.roleCode&&d.roleCode!==current.rows[0].role_code)||(d.status&&d.status!=='ACTIVE'));
    if(removesOwner){
      const owners=await client.query("SELECT COUNT(*)::int AS count FROM organisation_memberships WHERE organisation_id=$1 AND status='ACTIVE' AND role_code IN ('RETAIL_OWNER','BAR_OWNER')",[orgId(req)]);
      if(owners.rows[0].count<=1){await client.query('ROLLBACK');return fail(res,'LAST_OWNER_PROTECTED','The last active organisation owner cannot be demoted, suspended or revoked',409);}
    }
    const result=await client.query(`UPDATE organisation_memberships SET role_code=COALESCE($1,role_code),status=COALESCE($2,status) WHERE user_id=$3 AND organisation_id=$4 RETURNING user_id,organisation_id,role_code,status`,[d.roleCode??null,d.status??null,req.params.userId,orgId(req)]);
    await client.query(`INSERT INTO audit_events(organisation_id,actor_user_id,event_type,entity_type,entity_id,metadata) VALUES($1,$2,'MEMBERSHIP_UPDATED','USER_MEMBERSHIP',$3,$4)`,[orgId(req),req.auth!.userId,req.params.userId,d]);
    await client.query('COMMIT');return res.json({data:result.rows[0]});
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
});

organisationAccessRouter.put('/organisation/members/:userId/outlets', requirePermission('user:manage'), async(req,res)=>{
  const parsed=z.object({outletIds:z.array(uuid).max(100)}).strict().safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',details:parsed.error.flatten()}});
  if(!orgId(req))return fail(res,'ORG_CONTEXT_REQUIRED','Select an organisation to continue',409);
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const membership=await client.query("SELECT 1 FROM organisation_memberships WHERE user_id=$1 AND organisation_id=$2 AND status='ACTIVE' FOR UPDATE",[req.params.userId,orgId(req)]);
    if(!membership.rowCount){await client.query('ROLLBACK');return fail(res,'MEMBERSHIP_NOT_FOUND','Active organisation membership not found',404);}
    if(parsed.data.outletIds.length){const valid=await client.query('SELECT id FROM outlets WHERE organisation_id=$1 AND id=ANY($2::uuid[])',[orgId(req),parsed.data.outletIds]);if(valid.rowCount!==new Set(parsed.data.outletIds).size){await client.query('ROLLBACK');return fail(res,'INVALID_OUTLET_SCOPE','One or more outlets do not belong to this organisation',400);}}
    await client.query('DELETE FROM user_outlet_access WHERE user_id=$1 AND outlet_id IN (SELECT id FROM outlets WHERE organisation_id=$2)',[req.params.userId,orgId(req)]);
    for(const outletId of parsed.data.outletIds)await client.query('INSERT INTO user_outlet_access(user_id,outlet_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[req.params.userId,outletId]);
    await client.query(`INSERT INTO audit_events(organisation_id,actor_user_id,event_type,entity_type,entity_id,metadata) VALUES($1,$2,'USER_OUTLET_ACCESS_UPDATED','USER',$3,$4)`,[orgId(req),req.auth!.userId,req.params.userId,{outletIds:parsed.data.outletIds}]);
    await client.query('COMMIT');return res.json({data:{userId:req.params.userId,outletIds:parsed.data.outletIds}});
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
});

organisationAccessRouter.get('/organisation/audit-events', requirePermission('audit:read'), async(req,res)=>{
  if(!orgId(req))return fail(res,'ORG_CONTEXT_REQUIRED','Select an organisation to continue',409);
  const limit=Math.min(Math.max(Number(req.query.limit)||50,1),200);
  const result=await pool.query(`SELECT id,outlet_id,actor_user_id,event_type,entity_type,entity_id,reason,metadata,occurred_at FROM audit_events WHERE organisation_id=$1 ORDER BY occurred_at DESC LIMIT $2`,[orgId(req),limit]);
  return res.json({data:result.rows});
});
