import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { requireOrgScope } from '../middleware/requireOrgScope.js';

export const offlineReconciliationRouter = Router();
offlineReconciliationRouter.use(authenticate, requireOrgScope);
const uuid = z.string().uuid();
const org = (req: any) => req.auth.organisationId as string;
const fail = (res: any, code: string, message: string, status = 400) => res.status(status).json({ error: { code, message } });

// Review queue is organisation-scoped; conflicts remain visible and cannot be silently approved.
offlineReconciliationRouter.get('/offline/reconciliation/events', requirePermission('offline:read'), async (req: any, res: any) => {
  const status = z.enum(['REVIEW_REQUIRED','CONFLICT','REJECTED','APPROVED_NO_POST']).optional().safeParse(req.query.status);
  if (!status.success) return fail(res, 'INVALID_STATUS', 'Unsupported event status');
  const batchId = req.query.batchId ? uuid.safeParse(req.query.batchId) : null;
  if (batchId && !batchId.success) return fail(res, 'INVALID_BATCH_ID', 'Invalid batch ID');
  const values: unknown[] = [org(req)];
  let where = 'e.organisation_id=$1';
  if (status.data) { values.push(status.data); where += ` AND e.status=$${values.length}`; }
  if (batchId?.success) { values.push(batchId.data); where += ` AND e.batch_id=$${values.length}`; }
  values.push(250);
  const result = await pool.query(`SELECT e.id,e.batch_id,e.outlet_id,e.device_id,e.event_id,e.sequence_no,e.event_type,e.payload,e.status,e.received_at,e.reviewed_by,e.reviewed_at,e.review_reason,b.submitted_by
    FROM offline_sync_events e JOIN offline_sync_batches b ON b.id=e.batch_id
    WHERE ${where} ORDER BY e.received_at ASC LIMIT $${values.length}`, values);
  res.json({ data: result.rows, financialPosting: 'DISABLED' });
});

offlineReconciliationRouter.post('/offline/reconciliation/events/:eventId/decision', requirePermission('offline:review'), async (req: any, res: any) => {
  if (!uuid.safeParse(req.params.eventId).success) return fail(res, 'INVALID_EVENT_ID', 'Invalid event ID');
  const parsed = z.object({ decision: z.enum(['APPROVE','REJECT']), reason: z.string().trim().min(8).max(500) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const selected = await client.query(`SELECT e.*,b.submitted_by FROM offline_sync_events e
      JOIN offline_sync_batches b ON b.id=e.batch_id
      WHERE e.id=$1 AND e.organisation_id=$2 FOR UPDATE OF e,b`, [req.params.eventId, org(req)]);
    if (!selected.rowCount) { await client.query('ROLLBACK'); return fail(res, 'EVENT_NOT_FOUND', 'Offline event not found', 404); }
    const event = selected.rows[0];
    if (event.submitted_by === req.auth!.userId) { await client.query('ROLLBACK'); return fail(res, 'MAKER_CHECKER_REQUIRED', 'The submitting user cannot review their own batch', 403); }
    if (event.status !== 'REVIEW_REQUIRED') { await client.query('ROLLBACK'); return fail(res, 'EVENT_NOT_REVIEWABLE', `Event status ${event.status} cannot be reviewed`, 409); }
    const nextStatus = parsed.data.decision === 'APPROVE' ? 'APPROVED_NO_POST' : 'REJECTED';
    const updated = await client.query(`UPDATE offline_sync_events SET status=$1,reviewed_by=$2,reviewed_at=NOW(),review_reason=$3
      WHERE id=$4 RETURNING id,batch_id,event_id,status,reviewed_by,reviewed_at,review_reason`,
      [nextStatus, req.auth!.userId, parsed.data.reason, event.id]);
    await client.query(`INSERT INTO offline_sync_audit(organisation_id,batch_id,actor_user_id,action,details)
      VALUES($1,$2,$3,'RECONCILIATION_DECISION',$4::jsonb)`, [org(req), event.batch_id, req.auth!.userId,
      JSON.stringify({ eventId: event.event_id, decision: parsed.data.decision, status: nextStatus, reason: parsed.data.reason })]);
    const counts = await client.query(`SELECT COUNT(*) FILTER(WHERE status IN ('REVIEW_REQUIRED','CONFLICT'))::int AS open_count,
      COUNT(*) FILTER(WHERE status='REJECTED')::int AS rejected_count,
      COUNT(*) FILTER(WHERE status='APPROVED_NO_POST')::int AS approved_count
      FROM offline_sync_events WHERE batch_id=$1`, [event.batch_id]);
    const c = counts.rows[0];
    const batchStatus = Number(c.open_count) > 0 ? 'REVIEW_REQUIRED' : (Number(c.approved_count) > 0 ? 'REVIEWED' : 'REJECTED');
    await client.query('UPDATE offline_sync_batches SET status=$1 WHERE id=$2', [batchStatus, event.batch_id]);
    await client.query('COMMIT');
    res.json({ data: updated.rows[0], batchStatus, financialPosting: 'DISABLED', note: 'Approval records a review decision only; it does not create a sale, payment, stock movement or journal.' });
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
});
