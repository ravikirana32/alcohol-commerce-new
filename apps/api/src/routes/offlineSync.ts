import { Router } from 'express';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { requireOrgScope } from '../middleware/requireOrgScope.js';

export const offlineSyncRouter = Router();
offlineSyncRouter.use(authenticate, requireOrgScope);
const uuid = z.string().uuid();
const eventSchema = z.object({
  eventId: z.string().trim().min(8).max(160), sequence: z.number().int().positive().safe(),
  type: z.enum(['RETAIL_SALE','BAR_CHECKOUT','STOCK_ADJUSTMENT','DEVICE_DIAGNOSTIC']),
  payload: z.record(z.unknown())
});
const batchSchema = z.object({ batchId: uuid, deviceId: uuid, outletId: uuid,
  events: z.array(eventSchema).min(1).max(500) });
const org = (req: any) => req.auth.organisationId as string;
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail = (res: any, code: string, message: string, status = 400) => res.status(status).json({ error: { code, message } });

// Device enrolment is administrator-controlled. The caller cannot select another organisation.
offlineSyncRouter.post('/offline/devices', requirePermission('offline:manage'), async (req: any, res: any) => {
  const parsed = z.object({ deviceId: uuid, outletId: uuid, label: z.string().trim().min(2).max(120) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;
  const outlet = await pool.query('SELECT id FROM outlets WHERE id=$1 AND organisation_id=$2', [d.outletId, org(req)]);
  if (!outlet.rowCount) return fail(res, 'OUTLET_NOT_FOUND', 'Outlet is not part of this organisation', 404);
  const result = await pool.query(`INSERT INTO offline_sync_devices(id,organisation_id,outlet_id,label)
    VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET label=EXCLUDED.label,status='ACTIVE'
    WHERE offline_sync_devices.organisation_id=EXCLUDED.organisation_id AND offline_sync_devices.outlet_id=EXCLUDED.outlet_id
    RETURNING id,outlet_id,label,status,created_at`, [d.deviceId, org(req), d.outletId, d.label]);
  if (!result.rowCount) return fail(res, 'DEVICE_ID_CONFLICT', 'Device ID is already enrolled elsewhere', 409);
  res.status(201).json({ data: result.rows[0] });
});

offlineSyncRouter.post('/offline/devices/:deviceId/revoke', requirePermission('offline:manage'), async (req: any, res: any) => {
  if (!uuid.safeParse(req.params.deviceId).success) return fail(res, 'INVALID_DEVICE_ID', 'Invalid device ID');
  const result = await pool.query(`UPDATE offline_sync_devices SET status='REVOKED'
    WHERE id=$1 AND organisation_id=$2 RETURNING id,status`, [req.params.deviceId, org(req)]);
  if (!result.rowCount) return fail(res, 'DEVICE_NOT_FOUND', 'Device not found', 404);
  res.json({ data: result.rows[0] });
});

// Intake is idempotent. Sales/checkouts are persisted as REVIEW_REQUIRED and NEVER posted here.
offlineSyncRouter.post('/offline/sync-batches', requirePermission('offline:sync'), async (req: any, res: any) => {
  const parsed = batchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const batch = parsed.data;
  if (new Set(batch.events.map(e => e.eventId)).size !== batch.events.length ||
      new Set(batch.events.map(e => e.sequence)).size !== batch.events.length)
    return fail(res, 'DUPLICATE_BATCH_EVENT', 'Batch contains duplicate event IDs or sequence numbers');
  const serialised = JSON.stringify(batch.events);
  if (Buffer.byteLength(serialised, 'utf8') > 1024 * 1024) return fail(res, 'BATCH_TOO_LARGE', 'Batch exceeds 1 MiB');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const device = await client.query(`SELECT id FROM offline_sync_devices
      WHERE id=$1 AND organisation_id=$2 AND outlet_id=$3 AND status='ACTIVE' FOR UPDATE`,
      [batch.deviceId, org(req), batch.outletId]);
    if (!device.rowCount) { await client.query('ROLLBACK'); return fail(res, 'DEVICE_NOT_ACTIVE', 'Device is not active for this outlet', 403); }
    const payloadHash = digest(batch.events);
    const existing = await client.query('SELECT id,organisation_id,payload_hash,status FROM offline_sync_batches WHERE id=$1', [batch.batchId]);
    if (existing.rowCount) {
      if (existing.rows[0].organisation_id !== org(req) || existing.rows[0].payload_hash !== payloadHash) { await client.query('ROLLBACK'); return fail(res, 'BATCH_ID_REUSE', 'Batch ID was already used and cannot be reused', 409); }
      await client.query('COMMIT');
      return res.json({ data: { batchId: batch.batchId, status: existing.rows[0].status, replay: true, financialPosting: 'DISABLED' } });
    }
    await client.query(`INSERT INTO offline_sync_batches(id,organisation_id,outlet_id,device_id,payload_hash,event_count,status,submitted_by)
      VALUES($1,$2,$3,$4,$5,$6,'REVIEW_REQUIRED',$7)`,
      [batch.batchId, org(req), batch.outletId, batch.deviceId, payloadHash, batch.events.length, req.auth!.userId]);
    const accepted: string[] = [], duplicates: string[] = [], conflicts: string[] = [];
    for (const event of batch.events) {
      const eventHash = digest({ type: event.type, payload: event.payload, sequence: event.sequence });
      const prior = await client.query(`SELECT event_id,sequence_no,payload_hash FROM offline_sync_events
        WHERE organisation_id=$1 AND device_id=$2 AND (event_id=$3 OR sequence_no=$4) LIMIT 1`,
        [org(req), batch.deviceId, event.eventId, event.sequence]);
      if (prior.rowCount) {
        const same = prior.rows[0].event_id === event.eventId && Number(prior.rows[0].sequence_no) === event.sequence && prior.rows[0].payload_hash === eventHash;
        const status = same ? 'DUPLICATE' : 'CONFLICT';
        await client.query(`INSERT INTO offline_sync_audit(organisation_id,batch_id,actor_user_id,action,details)
          VALUES($1,$2,$3,$4,$5::jsonb)`, [org(req), batch.batchId, req.auth!.userId,
          same ? 'EVENT_DUPLICATE' : 'EVENT_CONFLICT', JSON.stringify({ eventId: event.eventId, sequence: event.sequence })]);
        (same ? duplicates : conflicts).push(event.eventId);
        continue;
      }
      await client.query(`INSERT INTO offline_sync_events(organisation_id,outlet_id,device_id,batch_id,event_id,sequence_no,event_type,payload,payload_hash,status)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,'REVIEW_REQUIRED')`,
        [org(req), batch.outletId, batch.deviceId, batch.batchId, event.eventId, event.sequence, event.type, JSON.stringify(event.payload), eventHash]);
      accepted.push(event.eventId);
      await client.query(`INSERT INTO offline_sync_audit(organisation_id,batch_id,actor_user_id,action,details)
        VALUES($1,$2,$3,'EVENT_ACCEPTED',$4::jsonb)`, [org(req), batch.batchId, req.auth!.userId, JSON.stringify({ eventId: event.eventId, sequence: event.sequence, type: event.type })]);
    }
    await client.query(`UPDATE offline_sync_devices SET last_seen_at=NOW() WHERE id=$1`, [batch.deviceId]);
    const checkpoint = await client.query(`SELECT COALESCE(MAX(sequence_no),0)::bigint AS max_sequence FROM offline_sync_events WHERE organisation_id=$1 AND device_id=$2`, [org(req), batch.deviceId]);
    await client.query(`INSERT INTO p580_offline_sync_checkpoints(organisation_id,device_id,outlet_id,max_seen_sequence,last_batch_id,updated_by)
      VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(organisation_id,device_id) DO UPDATE SET
      max_seen_sequence=GREATEST(p580_offline_sync_checkpoints.max_seen_sequence,EXCLUDED.max_seen_sequence),
      last_batch_id=EXCLUDED.last_batch_id,updated_by=EXCLUDED.updated_by,updated_at=NOW()`,
      [org(req), batch.deviceId, batch.outletId, checkpoint.rows[0].max_sequence, batch.batchId, req.auth!.userId]);
    await client.query(`INSERT INTO offline_sync_audit(organisation_id,batch_id,actor_user_id,action,details)
      VALUES($1,$2,$3,'BATCH_RECEIVED',$4::jsonb)`, [org(req), batch.batchId, req.auth!.userId,
      JSON.stringify({ accepted: accepted.length, duplicates: duplicates.length, conflicts: conflicts.length })]);
    await client.query('COMMIT');
    res.status(202).json({ data: { batchId: batch.batchId, status: 'REVIEW_REQUIRED', accepted, duplicates, conflicts, financialPosting: 'DISABLED' } });
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
});

offlineSyncRouter.get('/offline/sync-batches', requirePermission('offline:read'), async (req: any, res: any) => {
  const result = await pool.query(`SELECT b.id,b.outlet_id,b.device_id,b.event_count,b.status,b.received_at,
    COUNT(e.id)::int AS persisted_events, COUNT(e.id) FILTER(WHERE e.status='REVIEW_REQUIRED')::int AS awaiting_review,
    COUNT(e.id) FILTER(WHERE e.status='CONFLICT')::int AS conflicts
    FROM offline_sync_batches b LEFT JOIN offline_sync_events e ON e.batch_id=b.id
    WHERE b.organisation_id=$1 GROUP BY b.id ORDER BY b.received_at DESC LIMIT 100`, [org(req)]);
  res.json({ data: result.rows, financialPosting: 'DISABLED' });
});
