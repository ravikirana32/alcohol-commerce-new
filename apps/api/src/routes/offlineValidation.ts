import { Router } from 'express';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { requireOrgScope } from '../middleware/requireOrgScope.js';

export const offlineValidationRouter = Router();
offlineValidationRouter.use(authenticate, requireOrgScope);
const org = (req: any) => req.auth.organisationId as string;
const uuid = z.string().uuid();
const fail = (res: any, code: string, message: string, status = 400) => res.status(status).json({ error: { code, message } });
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function validatePayload(type: string, payload: Record<string, unknown>) {
  const checks: Array<{ key: string; passed: boolean; detail: string }> = [];
  const add = (key: string, passed: boolean, detail: string) => checks.push({ key, passed, detail });
  add('payload_object', !!payload && typeof payload === 'object' && !Array.isArray(payload), 'Payload must be a JSON object');
  if (type === 'DEVICE_DIAGNOSTIC') {
    add('diagnostic_type', typeof payload.kind === 'string' && payload.kind.length <= 80, 'Diagnostic kind must be supplied');
  } else if (type === 'RETAIL_SALE' || type === 'BAR_CHECKOUT') {
    const items = payload.items;
    const total = payload.totalMinor;
    const occurredAt = typeof payload.occurredAt === 'string' ? Date.parse(payload.occurredAt) : NaN;
    add('items', Array.isArray(items) && items.length > 0 && items.length <= 200, 'Sale must contain 1–200 item lines');
    add('total_minor', Number.isSafeInteger(total) && Number(total) > 0, 'totalMinor must be a positive integer in paise');
    add('currency', payload.currency === 'INR', 'Currency must be INR');
    add('occurred_at', Number.isFinite(occurredAt), 'occurredAt must be a valid ISO date/time');
    add('client_reference', typeof payload.clientReference === 'string' && payload.clientReference.length >= 8 && payload.clientReference.length <= 160, 'clientReference is required');
    if (Array.isArray(items)) items.forEach((item, index) => {
      const line = item as Record<string, unknown>;
      const baseValid = typeof line.productId === 'string' && uuid.safeParse(line.productId).success && Number.isSafeInteger(line.quantity) && Number(line.quantity) > 0;
      const barValid = type !== 'BAR_CHECKOUT' || (
        ['PEG','BOTTLE','PACKAGED'].includes(String(line.lineType)) && Number.isSafeInteger(line.unitPriceMinor) && Number(line.unitPriceMinor) > 0 &&
        (line.lineType === 'PEG'
          ? Number.isSafeInteger(line.volumeMl) && Number(line.volumeMl) > 0 && typeof line.openBottleId === 'string' && uuid.safeParse(line.openBottleId).success
          : line.volumeMl == null && line.openBottleId == null)
      );
      add(`item_${index + 1}`, baseValid && barValid, `Line ${index + 1} requires a valid product, positive integer quantity${type === 'BAR_CHECKOUT' ? ' and a valid line type, unit price, and peg bottle/measure allocation where applicable' : ''}`);
    });
    add('payments', Array.isArray(payload.payments) && payload.payments.length > 0, 'Payment allocation evidence is required');
  } else if (type === 'STOCK_ADJUSTMENT') {
    add('product_id', typeof payload.productId === 'string', 'productId is required');
    add('quantity_delta', Number.isSafeInteger(payload.quantityDelta) && Number(payload.quantityDelta) !== 0, 'quantityDelta must be a non-zero integer');
    add('reason', typeof payload.reason === 'string' && payload.reason.trim().length >= 8, 'A stock adjustment reason is required');
  } else add('event_type', false, 'Unsupported event type');
  return { checks, passed: checks.every(c => c.passed) };
}

offlineValidationRouter.post('/offline/reconciliation/events/:eventId/validate', requirePermission('offline:validate'), async (req: any, res: any) => {
  if (!uuid.safeParse(req.params.eventId).success) return fail(res, 'INVALID_EVENT_ID', 'Invalid event ID');
  const parsed = z.object({ notes: z.string().trim().min(8).max(500) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const selected = await client.query(`SELECT e.* FROM offline_sync_events e WHERE e.id=$1 AND e.organisation_id=$2 FOR UPDATE`, [req.params.eventId, org(req)]);
    if (!selected.rowCount) { await client.query('ROLLBACK'); return fail(res, 'EVENT_NOT_FOUND', 'Offline event not found', 404); }
    const event = selected.rows[0];
    if (event.status !== 'APPROVED_NO_POST' && event.status !== 'VALIDATION_FAILED') { await client.query('ROLLBACK'); return fail(res, 'EVENT_NOT_APPROVED', 'Only independently approved events can be validated', 409); }
    const prior = await client.query('SELECT id FROM offline_event_validations WHERE event_row_id=$1', [event.id]);
    if (prior.rowCount) { await client.query('ROLLBACK'); return fail(res, 'VALIDATION_ALREADY_RECORDED', 'Validation evidence is immutable; a new event must be submitted for re-validation', 409); }
    const result = validatePayload(event.event_type, event.payload);
    const outcome = result.passed ? 'PASS' : 'FAIL';
    await client.query(`INSERT INTO offline_event_validations(organisation_id,event_row_id,validator_user_id,outcome,checks,notes) VALUES($1,$2,$3,$4,$5::jsonb,$6)`, [org(req), event.id, req.auth!.userId, outcome, JSON.stringify(result.checks), parsed.data.notes]);
    let intent = null;
    if (result.passed && event.event_type !== 'DEVICE_DIAGNOSTIC') {
      const created = await client.query(`INSERT INTO offline_posting_intents(organisation_id,outlet_id,event_row_id,event_id,event_type,payload_hash,created_by)
        VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(event_row_id) DO NOTHING RETURNING id,status`, [org(req), event.outlet_id, event.id, event.event_id, event.event_type, event.payload_hash, req.auth!.userId]);
      intent = created.rows[0] ?? null;
    }
    const next = result.passed ? (event.event_type === 'DEVICE_DIAGNOSTIC' ? 'APPROVED_NO_POST' : 'READY_FOR_POST') : 'VALIDATION_FAILED';
    await client.query('UPDATE offline_sync_events SET status=$1 WHERE id=$2', [next, event.id]);
    await client.query(`INSERT INTO offline_sync_audit(organisation_id,batch_id,actor_user_id,action,details) VALUES($1,$2,$3,'VALIDATION_RESULT',$4::jsonb)`, [org(req), event.batch_id, req.auth!.userId, JSON.stringify({ eventId: event.event_id, outcome, status: next, checks: result.checks })]);
    await client.query('COMMIT');
    res.json({ data: { eventId: event.event_id, outcome, status: next, checks: result.checks, postingIntent: intent, ledgerPosting: 'NOT_EXECUTED' } });
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
});

offlineValidationRouter.get('/offline/posting-intents', requirePermission('offline:posting-intents:read'), async (req: any, res: any) => {
  const status = z.enum(['READY_FOR_POST','HELD','CANCELLED']).optional().safeParse(req.query.status);
  if (!status.success) return fail(res, 'INVALID_STATUS', 'Unsupported posting intent status');
  const values: unknown[] = [org(req)]; let where = 'i.organisation_id=$1';
  if (status.data) { values.push(status.data); where += ` AND i.status=$${values.length}`; }
  values.push(250);
  const result = await pool.query(`SELECT i.id,i.outlet_id,i.event_id,i.event_type,i.payload_hash,i.status,i.created_at,v.outcome,v.checks,v.notes
    FROM offline_posting_intents i JOIN offline_event_validations v ON v.event_row_id=i.event_row_id WHERE ${where} ORDER BY i.created_at DESC LIMIT $${values.length}`, values);
  res.json({ data: result.rows, ledgerPosting: 'NOT_EXECUTED', note: 'These are validated posting intents only; no financial or stock ledger is mutated in P527.' });
});
