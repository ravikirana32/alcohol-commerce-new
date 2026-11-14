import type { NextFunction, Request, Response } from 'express';
import { createHash } from 'node:crypto';
import { pool } from '../db/pool.js';

const WINDOW_MS=60_000, MAX_REQUESTS=30;
export async function securityRateLimit(req:Request,res:Response,next:NextFunction) {
 if(!/^\/api\/v1\/auth\/(login|refresh|forgot-password|reset-password)(\/|$)/i.test(req.path))return next();
 try {
  const address=req.ip||req.socket.remoteAddress||'unknown';
  const digest=createHash('sha256').update(`${req.path}:${address}`).digest('hex');
  const now=new Date();const windowStart=new Date(Math.floor(now.getTime()/WINDOW_MS)*WINDOW_MS);
  const expires=new Date(windowStart.getTime()+WINDOW_MS*2);
  const r=await pool.query(`INSERT INTO p583_rate_limit_buckets(bucket_key,window_started_at,request_count,expires_at)
   VALUES($1,$2,1,$3) ON CONFLICT(bucket_key) DO UPDATE SET
   request_count=CASE WHEN p583_rate_limit_buckets.window_started_at=EXCLUDED.window_started_at THEN p583_rate_limit_buckets.request_count+1 ELSE 1 END,
   window_started_at=EXCLUDED.window_started_at,expires_at=EXCLUDED.expires_at,updated_at=NOW()
   RETURNING request_count,window_started_at`,[digest,windowStart,expires]);
  const count=Number(r.rows[0].request_count);const resetAt=windowStart.getTime()+WINDOW_MS;
  res.setHeader('RateLimit-Limit',String(MAX_REQUESTS));res.setHeader('RateLimit-Remaining',String(Math.max(0,MAX_REQUESTS-count)));res.setHeader('RateLimit-Reset',String(Math.ceil(resetAt/1000)));
  if(count>MAX_REQUESTS){res.setHeader('Retry-After',String(Math.max(1,Math.ceil((resetAt-now.getTime())/1000))));res.status(429).json({error:{code:'AUTH_RATE_LIMITED',message:'Too many authentication attempts. Retry later.'},requestId:res.locals.requestId});return;}
  next();
 } catch(error) { console.error('[security-rate-limit]',error instanceof Error?error.message:'unknown');res.status(503).json({error:{code:'AUTH_RATE_LIMIT_UNAVAILABLE',message:'Authentication throttling is temporarily unavailable.'},requestId:res.locals.requestId}); }
}
