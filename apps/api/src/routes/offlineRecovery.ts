import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { requireOrgScope } from '../middleware/requireOrgScope.js';
import { canCancelRecovery, canDecideCompensation, canRequestCompensation, canRequestRetry, canTriage } from '../services/offlineRecoveryPolicy.js';

export const offlineRecoveryRouter = Router();
offlineRecoveryRouter.use(authenticate, requireOrgScope);
const org = (req: any) => req.auth.organisationId as string;
const uuid = z.string().uuid();
const fail = (res: any, code: string, message: string, status = 400) => res.status(status).json({ error: { code, message } });

async function appendAction(client: any, caseRow: any, actorId: string, action: string, reason: string, metadata: Record<string, unknown> = {}) {
  await client.query(`INSERT INTO offline_recovery_actions(organisation_id,case_id,actor_user_id,action,reason,metadata)
    VALUES($1,$2,$3,$4,$5,$6::jsonb)`, [caseRow.organisation_id, caseRow.id, actorId, action, reason, JSON.stringify(metadata)]);
  await client.query(`INSERT INTO offline_sync_audit(organisation_id,batch_id,actor_user_id,action,details)
    SELECT $1,e.batch_id,$2,$3,$4::jsonb FROM offline_sync_events e WHERE e.id=$5`,
    [caseRow.organisation_id, actorId, `RECOVERY_${action}`, JSON.stringify({ caseId: caseRow.id, reason, ...metadata }), caseRow.event_row_id]);
}

// Blocked posting executions automatically receive a case from P532's posting hook.
offlineRecoveryRouter.get('/offline/recovery/cases', requirePermission('offline:recovery-read'), async (req: any, res: any) => {
  const parsed = z.enum(['OPEN','TRIAGED','RETRY_REQUIRED','CANCELLED','COMPENSATION_PENDING','COMPENSATION_APPROVED','COMPENSATION_REJECTED','RESOLVED']).optional().safeParse(req.query.status);
  if (!parsed.success) return fail(res, 'INVALID_STATUS', 'Unsupported recovery case status');
  const values: unknown[] = [org(req)];
  const filter = parsed.data ? ` AND c.status=$2` : '';
  if (parsed.data) values.push(parsed.data);
  const result = await pool.query(`SELECT c.id,c.outlet_id,c.execution_id,c.posting_intent_id,c.event_row_id,c.case_type,c.status,c.reason_code,c.description,c.created_by,c.triaged_by,c.triage_notes,c.requested_by,c.decided_by,c.decision_reason,c.created_at,c.updated_at,
      e.outcome AS execution_outcome,e.sale_id,e.bar_ticket_id,i.status AS intent_status,i.event_type
    FROM offline_recovery_cases c JOIN offline_posting_executions e ON e.id=c.execution_id
    JOIN offline_posting_intents i ON i.id=c.posting_intent_id
    WHERE c.organisation_id=$1${filter} ORDER BY c.created_at DESC LIMIT 250`, values);
  res.json({ data: result.rows, compensationExecution: 'NOT_IMPLEMENTED', financialMutation: 'NONE' });
});

offlineRecoveryRouter.post('/offline/recovery/executions/:executionId/case', requirePermission('offline:recovery-manage'), async (req: any, res: any) => {
  if (!uuid.safeParse(req.params.executionId).success) return fail(res, 'INVALID_EXECUTION_ID', 'Invalid execution ID');
  const parsed = z.object({ description: z.string().trim().min(8).max(1000) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query(`SELECT e.*,i.event_type,i.id AS intent_id,i.status AS intent_status FROM offline_posting_executions e
      JOIN offline_posting_intents i ON i.id=e.posting_intent_id WHERE e.id=$1 AND e.organisation_id=$2 FOR UPDATE OF e,i`, [req.params.executionId, org(req)]);
    if (!found.rowCount) { await client.query('ROLLBACK'); return fail(res, 'EXECUTION_NOT_FOUND', 'Posting execution not found', 404); }
    const e = found.rows[0];
    const created = await client.query(`INSERT INTO offline_recovery_cases(organisation_id,outlet_id,execution_id,posting_intent_id,event_row_id,case_type,reason_code,description,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(execution_id) DO NOTHING RETURNING *`,
      [org(req), e.outlet_id, e.id, e.posting_intent_id, e.event_row_id, e.outcome === 'POSTED' ? 'POSTED_TRANSACTION_REVIEW' : 'POSTING_BLOCK', e.reason_code ?? 'POSTED_REVIEW', parsed.data.description, req.auth!.userId]);
    const row = created.rows[0] ?? (await client.query('SELECT * FROM offline_recovery_cases WHERE execution_id=$1', [e.id])).rows[0];
    if (created.rowCount) await appendAction(client, row, req.auth!.userId, 'CASE_OPENED', parsed.data.description, { executionId: e.id });
    await client.query('COMMIT');
    res.status(created.rowCount ? 201 : 200).json({ data: row, idempotentReplay: !created.rowCount });
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
});

offlineRecoveryRouter.post('/offline/recovery/cases/:caseId/triage', requirePermission('offline:recovery-manage'), async (req: any, res: any) => {
  if (!uuid.safeParse(req.params.caseId).success) return fail(res, 'INVALID_CASE_ID', 'Invalid case ID');
  const parsed = z.object({ notes: z.string().trim().min(8).max(1000) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const selected = await client.query('SELECT * FROM offline_recovery_cases WHERE id=$1 AND organisation_id=$2 FOR UPDATE', [req.params.caseId, org(req)]);
    if (!selected.rowCount) { await client.query('ROLLBACK'); return fail(res, 'CASE_NOT_FOUND', 'Recovery case not found', 404); }
    const c = selected.rows[0];
    if (!canTriage(c.status)) { await client.query('ROLLBACK'); return fail(res, 'CASE_NOT_TRIAGEABLE', 'Only open or triaged cases can be triaged', 409); }
    const updated = await client.query(`UPDATE offline_recovery_cases SET status='TRIAGED',triaged_by=$1,triage_notes=$2,updated_at=NOW() WHERE id=$3 AND organisation_id=$4 RETURNING *`, [req.auth!.userId, parsed.data.notes, c.id, org(req)]);
    await appendAction(client, c, req.auth!.userId, 'TRIAGED', parsed.data.notes);
    await client.query('COMMIT'); res.json({ data: updated.rows[0] });
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
});

offlineRecoveryRouter.post('/offline/recovery/cases/:caseId/retry-request', requirePermission('offline:recovery-manage'), async (req: any, res: any) => {
  if (!uuid.safeParse(req.params.caseId).success) return fail(res, 'INVALID_CASE_ID', 'Invalid case ID');
  const parsed = z.object({ reason: z.string().trim().min(8).max(1000) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const selected = await client.query(`SELECT c.*,e.outcome,e.reason_code AS execution_reason FROM offline_recovery_cases c JOIN offline_posting_executions e ON e.id=c.execution_id WHERE c.id=$1 AND c.organisation_id=$2 FOR UPDATE OF c,e`, [req.params.caseId, org(req)]);
    if (!selected.rowCount) { await client.query('ROLLBACK'); return fail(res, 'CASE_NOT_FOUND', 'Recovery case not found', 404); }
    const c = selected.rows[0];
    if (!canRequestRetry(c.status, c.outcome)) { await client.query('ROLLBACK'); return fail(res, 'RETRY_NOT_ALLOWED', 'Retry requires a triaged case with a blocked execution', 409); }
    const updated = await client.query(`UPDATE offline_recovery_cases SET status='RETRY_REQUIRED',requested_by=$1,decision_reason=$2,updated_at=NOW() WHERE id=$3 RETURNING *`, [req.auth!.userId, parsed.data.reason, c.id]);
    await appendAction(client, c, req.auth!.userId, 'RETRY_REQUESTED', parsed.data.reason, { requiresNewSourceEvent: true, originalExecutionImmutable: true });
    await client.query('COMMIT');
    res.json({ data: updated.rows[0], nextStep: 'CORRECT_SOURCE_AND_SUBMIT_NEW_EVENT', originalExecutionChanged: false, repostOriginalIntent: false });
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
});

offlineRecoveryRouter.post('/offline/recovery/cases/:caseId/cancel', requirePermission('offline:recovery-manage'), async (req: any, res: any) => {
  if (!uuid.safeParse(req.params.caseId).success) return fail(res, 'INVALID_CASE_ID', 'Invalid case ID');
  const parsed = z.object({ reason: z.string().trim().min(8).max(1000) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const selected = await client.query(`SELECT c.*,e.outcome,i.status AS intent_status FROM offline_recovery_cases c
      JOIN offline_posting_executions e ON e.id=c.execution_id JOIN offline_posting_intents i ON i.id=c.posting_intent_id
      WHERE c.id=$1 AND c.organisation_id=$2 FOR UPDATE OF c,i`, [req.params.caseId, org(req)]);
    if (!selected.rowCount) { await client.query('ROLLBACK'); return fail(res, 'CASE_NOT_FOUND', 'Recovery case not found', 404); }
    const c = selected.rows[0];
    if (!canCancelRecovery(c.status, c.outcome, c.intent_status)) { await client.query('ROLLBACK'); return fail(res, 'CANCEL_NOT_ALLOWED', 'Only an unposted held/blocked intent can be cancelled', 409); }
    await client.query("UPDATE offline_posting_intents SET status='CANCELLED' WHERE id=$1", [c.posting_intent_id]);
    await client.query("UPDATE offline_sync_events SET status='REJECTED' WHERE id=$1 AND status IN ('CONFLICT','READY_FOR_POST','VALIDATION_FAILED')", [c.event_row_id]);
    const updated = await client.query(`UPDATE offline_recovery_cases SET status='CANCELLED',requested_by=$1,decision_reason=$2,updated_at=NOW() WHERE id=$3 RETURNING *`, [req.auth!.userId, parsed.data.reason, c.id]);
    await appendAction(client, c, req.auth!.userId, 'CANCELLED', parsed.data.reason, { originalExecutionImmutable: true });
    await client.query('COMMIT'); res.json({ data: updated.rows[0], originalExecutionChanged: false, financialMutation: 'NONE' });
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
});

offlineRecoveryRouter.post('/offline/recovery/cases/:caseId/compensation-request', requirePermission('offline:recovery-manage'), async (req: any, res: any) => {
  if (!uuid.safeParse(req.params.caseId).success) return fail(res, 'INVALID_CASE_ID', 'Invalid case ID');
  const parsed = z.object({ reason: z.string().trim().min(8).max(1000) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const selected = await client.query(`SELECT c.*,e.outcome FROM offline_recovery_cases c JOIN offline_posting_executions e ON e.id=c.execution_id WHERE c.id=$1 AND c.organisation_id=$2 FOR UPDATE OF c`, [req.params.caseId, org(req)]);
    if (!selected.rowCount) { await client.query('ROLLBACK'); return fail(res, 'CASE_NOT_FOUND', 'Recovery case not found', 404); }
    const c = selected.rows[0];
    if (!canRequestCompensation(c.status, c.outcome)) { await client.query('ROLLBACK'); return fail(res, 'COMPENSATION_NOT_ALLOWED', 'Compensation review requires a posted transaction review case', 409); }
    const updated = await client.query(`UPDATE offline_recovery_cases SET status='COMPENSATION_PENDING',requested_by=$1,decision_reason=$2,updated_at=NOW() WHERE id=$3 RETURNING *`, [req.auth!.userId, parsed.data.reason, c.id]);
    await appendAction(client, c, req.auth!.userId, 'COMPENSATION_REQUESTED', parsed.data.reason, { noFinancialMutation: true });
    await client.query('COMMIT'); res.json({ data: updated.rows[0], nextStep: 'INDEPENDENT_COMPENSATION_DECISION', compensationExecution: 'NOT_IMPLEMENTED' });
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
});

offlineRecoveryRouter.post('/offline/recovery/cases/:caseId/compensation-decision', requirePermission('offline:recovery-compensate'), async (req: any, res: any) => {
  if (!uuid.safeParse(req.params.caseId).success) return fail(res, 'INVALID_CASE_ID', 'Invalid case ID');
  const parsed = z.object({ decision: z.enum(['APPROVE','REJECT']), reason: z.string().trim().min(8).max(1000) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const selected = await client.query('SELECT * FROM offline_recovery_cases WHERE id=$1 AND organisation_id=$2 FOR UPDATE', [req.params.caseId, org(req)]);
    if (!selected.rowCount) { await client.query('ROLLBACK'); return fail(res, 'CASE_NOT_FOUND', 'Recovery case not found', 404); }
    const c = selected.rows[0];
    if (!canDecideCompensation(c.status, c.requested_by, req.auth!.userId)) { await client.query('ROLLBACK'); return fail(res, 'MAKER_CHECKER_REQUIRED', 'A different authorised user must decide a pending compensation request', 403); }
    const approved = parsed.data.decision === 'APPROVE';
    const next = approved ? 'COMPENSATION_APPROVED' : 'COMPENSATION_REJECTED';
    const updated = await client.query(`UPDATE offline_recovery_cases SET status=$1,decided_by=$2,decision_reason=$3,updated_at=NOW() WHERE id=$4 RETURNING *`, [next, req.auth!.userId, parsed.data.reason, c.id]);
    await appendAction(client, c, req.auth!.userId, approved ? 'COMPENSATION_APPROVED' : 'COMPENSATION_REJECTED', parsed.data.reason, { compensationExecution: 'NOT_IMPLEMENTED', handoff: approved ? 'P536_FINANCE_COMPENSATION_WORKFLOW' : 'NONE', noFinancialMutation: true });
    await client.query('COMMIT'); res.json({ data: updated.rows[0], compensationExecution: 'NOT_IMPLEMENTED', financialMutation: 'NONE' });
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
});
