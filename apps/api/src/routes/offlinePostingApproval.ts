import { Router } from 'express';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { requireOrgScope } from '../middleware/requireOrgScope.js';

export const offlinePostingApprovalRouter = Router();
offlinePostingApprovalRouter.use(authenticate, requireOrgScope);
const org = (req: any) => req.auth.organisationId as string;
const uuid = z.string().uuid();
const fail = (res: any, code: string, message: string, status = 400) => res.status(status).json({ error: { code, message } });

// A separate approver authorizes a future posting worker. This endpoint never mutates ledgers.
offlinePostingApprovalRouter.post('/offline/posting-intents/:intentId/approval', requirePermission('offline:posting-approve'), async (req: any, res: any) => {
  if (!uuid.safeParse(req.params.intentId).success) return fail(res, 'INVALID_INTENT_ID', 'Invalid posting intent ID');
  const parsed = z.object({ decision: z.enum(['APPROVE','REJECT']), reason: z.string().trim().min(8).max(500) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(`SELECT i.*,e.reviewed_by,e.event_id AS source_event_id,b.submitted_by,
      v.validator_user_id,v.outcome AS validation_outcome,v.checks AS validation_checks,
      a.checked_by,a.outcome AS authoritative_outcome,a.checks AS authoritative_checks
      FROM offline_posting_intents i
      JOIN offline_sync_events e ON e.id=i.event_row_id
      JOIN offline_sync_batches b ON b.id=e.batch_id
      JOIN offline_event_validations v ON v.event_row_id=e.id
      LEFT JOIN offline_authoritative_checks a ON a.posting_intent_id=i.id
      WHERE i.id=$1 AND i.organisation_id=$2
      FOR UPDATE OF i,e`, [req.params.intentId, org(req)]);
    if (!result.rowCount) { await client.query('ROLLBACK'); return fail(res, 'INTENT_NOT_FOUND', 'Posting intent not found', 404); }
    const row = result.rows[0];
    if (row.status !== 'READY_FOR_POST') { await client.query('ROLLBACK'); return fail(res, 'INTENT_NOT_READY', `Intent status ${row.status} cannot be approved`, 409); }
    if (row.validation_outcome !== 'PASS' || row.authoritative_outcome !== 'PASS') { await client.query('ROLLBACK'); return fail(res, 'VALIDATION_REQUIRED', 'Both structural and authoritative checks must pass before approval', 409); }
    const prior = await client.query('SELECT id FROM offline_posting_approvals WHERE posting_intent_id=$1', [row.id]);
    if (prior.rowCount) { await client.query('ROLLBACK'); return fail(res, 'APPROVAL_IMMUTABLE', 'An approval decision already exists; submit a new source event for a new decision', 409); }
    const forbiddenActors = [row.created_by, row.submitted_by, row.reviewed_by, row.validator_user_id, row.checked_by].filter(Boolean).map(String);
    if (forbiddenActors.includes(String(req.auth!.userId))) { await client.query('ROLLBACK'); return fail(res, 'MAKER_CHECKER_REQUIRED', 'Approver must be different from submitter, reviewer, validator, authoritative checker and intent creator', 403); }
    const validationHash = createHash('sha256').update(JSON.stringify({
      intentId: row.id, payloadHash: row.payload_hash, validation: row.validation_checks,
      authoritative: row.authoritative_checks
    })).digest('hex');
    const approval = await client.query(`INSERT INTO offline_posting_approvals
      (organisation_id,outlet_id,posting_intent_id,event_row_id,approved_by,outcome,reason,validation_hash)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,outcome,reason,created_at`,
      [org(req), row.outlet_id, row.id, row.event_row_id, req.auth!.userId, parsed.data.decision, parsed.data.reason, validationHash]);
    const nextStatus = parsed.data.decision === 'APPROVE' ? 'AUTHORIZED_TO_POST' : 'HELD';
    await client.query('UPDATE offline_posting_intents SET status=$1 WHERE id=$2', [nextStatus, row.id]);
    await client.query(`INSERT INTO offline_sync_audit(organisation_id,batch_id,actor_user_id,action,details)
      SELECT $1,e.batch_id,$2,'POSTING_APPROVAL',$3::jsonb FROM offline_sync_events e WHERE e.id=$4`,
      [org(req), req.auth!.userId, JSON.stringify({ intentId: row.id, eventId: row.source_event_id, decision: parsed.data.decision, status: nextStatus, validationHash }), row.event_row_id]);
    await client.query('COMMIT');
    res.json({ data: { ...approval.rows[0], intentId: row.id, status: nextStatus, validationHash }, ledgerPosting: 'NOT_EXECUTED', note: 'Approval authorizes a future posting worker only. No sale, payment, stock movement or journal was created.' });
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
});

offlinePostingApprovalRouter.get('/offline/posting-approvals', requirePermission('offline:posting-approval-read'), async (req: any, res: any) => {
  const result = await pool.query(`SELECT a.id,a.posting_intent_id,a.event_row_id,a.approved_by,a.outcome,a.reason,a.validation_hash,a.created_at,i.status,i.event_id,i.event_type
    FROM offline_posting_approvals a JOIN offline_posting_intents i ON i.id=a.posting_intent_id
    WHERE a.organisation_id=$1 ORDER BY a.created_at DESC LIMIT 250`, [org(req)]);
  res.json({ data: result.rows, ledgerPosting: 'NOT_EXECUTED' });
});
