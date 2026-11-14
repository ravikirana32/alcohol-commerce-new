import { Router } from 'express';
import { createHash, randomBytes, createPublicKey, verify as verifySignature } from 'node:crypto';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireOrgScope } from '../middleware/requireOrgScope.js';
import { requirePermission } from '../middleware/requirePermission.js';

export const devicesRouter = Router();
devicesRouter.use(authenticate, requireOrgScope);
const org = (req: any) => req.auth.organisationId as string;
const fail = (res: any, code: string, message: string, status = 400) => res.status(status).json({ error: { code, message } });
const uuid = z.string().uuid();
const publicKeySchema = z.string().min(80).max(12000).refine((v) => v.includes('BEGIN PUBLIC KEY'), 'SPKI PEM public key required');

devicesRouter.get('/devices', requirePermission('device:read'), async (req: any,res:any) => {
  const r=await pool.query(`SELECT id,device_name,platform,key_fingerprint,status,last_attested_at,last_seen_at,created_at
    FROM pos_devices WHERE organisation_id=$1 ORDER BY created_at DESC`,[org(req)]);
  res.json({data:r.rows});
});

devicesRouter.post('/devices', requirePermission('device:manage'), async (req:any,res:any) => {
  const p=z.object({deviceName:z.string().trim().min(2).max(120),platform:z.enum(['IOS','ANDROID','WINDOWS','MACOS','LINUX','BROWSER']),publicKeyPem:publicKeySchema}).safeParse(req.body);
  if(!p.success)return res.status(400).json({error:p.error.flatten()});
  let fingerprint:string;
  try { fingerprint=createHash('sha256').update(createPublicKey(p.data.publicKeyPem).export({type:'spki',format:'der'})).digest('hex'); }
  catch { return fail(res,'INVALID_DEVICE_PUBLIC_KEY','Public key is not a valid supported key',400); }
  const r=await pool.query(`INSERT INTO pos_devices(organisation_id,device_name,platform,public_key_pem,key_fingerprint,created_by)
    VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(organisation_id,key_fingerprint) DO UPDATE SET
    device_name=EXCLUDED.device_name,platform=EXCLUDED.platform,updated_at=NOW()
    WHERE pos_devices.status<>'REVOKED' RETURNING id,device_name,platform,key_fingerprint,status,created_at`,
    [org(req),p.data.deviceName,p.data.platform,p.data.publicKeyPem,fingerprint,req.auth.userId]);
  if(!r.rowCount)return fail(res,'DEVICE_REVOKED','A revoked device key cannot be re-enrolled; generate a new key pair',409);
  res.status(201).json({data:r.rows[0]});
});

devicesRouter.post('/devices/:deviceId/challenge', requirePermission('device:manage'), async(req:any,res:any)=>{
  if(!uuid.safeParse(req.params.deviceId).success)return fail(res,'INVALID_DEVICE_ID','Invalid device id');
  const nonce=randomBytes(32).toString('base64url');
  const c=await pool.connect();
  try { await c.query('BEGIN');
    const d=await c.query("SELECT id FROM pos_devices WHERE id=$1 AND organisation_id=$2 AND status<>'REVOKED' FOR UPDATE",[req.params.deviceId,org(req)]);
    if(!d.rowCount){await c.query('ROLLBACK');return fail(res,'DEVICE_NOT_FOUND','Device not found',404);}
    await c.query("UPDATE pos_device_challenges SET consumed_at=NOW() WHERE device_id=$1 AND consumed_at IS NULL",[req.params.deviceId]);
    const r=await c.query(`INSERT INTO pos_device_challenges(device_id,challenge_hash,expires_at)
      VALUES($1,$2,NOW()+INTERVAL '2 minutes') RETURNING id,expires_at`,[req.params.deviceId,createHash('sha256').update(nonce).digest('hex')]);
    await c.query('COMMIT'); res.status(201).json({data:{challengeId:r.rows[0].id,nonce,expiresAt:r.rows[0].expires_at,algorithm:'RSA-SHA256 or ECDSA-SHA256'}});
  } catch(e){await c.query('ROLLBACK');throw e;} finally{c.release();}
});

devicesRouter.post('/devices/:deviceId/attest', requirePermission('device:manage'), async(req:any,res:any)=>{
  const p=z.object({challengeId:uuid,nonce:z.string().min(20).max(200),signature:z.string().min(20).max(2000),algorithm:z.enum(['RSA-SHA256','ECDSA-SHA256'])}).safeParse(req.body);
  if(!p.success)return res.status(400).json({error:p.error.flatten()});
  const c=await pool.connect();
  try { await c.query('BEGIN');
    const d=await c.query("SELECT id,public_key_pem FROM pos_devices WHERE id=$1 AND organisation_id=$2 AND status<>'REVOKED' FOR UPDATE",[req.params.deviceId,org(req)]);
    if(!d.rowCount){await c.query('ROLLBACK');return fail(res,'DEVICE_NOT_FOUND','Device not found',404);}
    const ch=await c.query(`SELECT id,challenge_hash FROM pos_device_challenges WHERE id=$1 AND device_id=$2
      AND consumed_at IS NULL AND expires_at>NOW() FOR UPDATE`,[p.data.challengeId,req.params.deviceId]);
    if(!ch.rowCount || ch.rows[0].challenge_hash!==createHash('sha256').update(p.data.nonce).digest('hex')){await c.query('ROLLBACK');return fail(res,'CHALLENGE_INVALID','Challenge is invalid, expired or already consumed',409);}
    let valid=false;
    try { const key=createPublicKey(d.rows[0].public_key_pem); const sig=Buffer.from(p.data.signature,'base64');
      valid=verifySignature(p.data.algorithm==='RSA-SHA256'?'RSA-SHA256':'sha256',Buffer.from(p.data.nonce),key,sig);
    } catch { valid=false; }
    await c.query('UPDATE pos_device_challenges SET consumed_at=NOW() WHERE id=$1',[p.data.challengeId]);
    if(!valid){await c.query('COMMIT');return fail(res,'DEVICE_SIGNATURE_INVALID','Device proof signature did not verify',401);}
    const u=await c.query("UPDATE pos_devices SET status='TRUSTED',last_attested_at=NOW(),last_seen_at=NOW(),updated_at=NOW() WHERE id=$1 RETURNING id,status,last_attested_at,last_seen_at",[req.params.deviceId]);
    await c.query('COMMIT');res.json({data:u.rows[0]});
  } catch(e){await c.query('ROLLBACK');throw e;} finally{c.release();}
});

devicesRouter.post('/devices/:deviceId/revoke', requirePermission('device:manage'), async(req:any,res:any)=>{
  const r=await pool.query("UPDATE pos_devices SET status='REVOKED',updated_at=NOW() WHERE id=$1 AND organisation_id=$2 AND status<>'REVOKED' RETURNING id,status,updated_at",[req.params.deviceId,org(req)]);
  if(!r.rowCount)return fail(res,'DEVICE_NOT_FOUND','Active device not found',404);
  await pool.query('UPDATE pos_device_challenges SET consumed_at=NOW() WHERE device_id=$1 AND consumed_at IS NULL',[req.params.deviceId]);
  res.json({data:r.rows[0]});
});
