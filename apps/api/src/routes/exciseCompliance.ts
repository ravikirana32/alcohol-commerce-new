import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { requireOrgScope } from '../middleware/requireOrgScope.js';
import { evaluateExciseSale } from '../services/exciseCompliance.js';

export const exciseComplianceRouter = Router();
exciseComplianceRouter.use(authenticate, requireOrgScope);
const uuid = z.string().uuid();
const org = (req: any) => req.auth.organisationId as string;
const fail = (res: any, code: string, message: string, status = 400) => res.status(status).json({ error: { code, message } });
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const weeklyHoursSchema = z.record(z.string(), z.object({ open: time, close: time }).refine(v => v.open !== v.close));

exciseComplianceRouter.post('/excise/rule-packs', requirePermission('excise:manage-rules'), async (req: any, res: any) => {
  if (!req.auth!.isPlatformAdmin) return fail(res, 'PLATFORM_ADMIN_REQUIRED', 'Only platform administrators can create legal rule packs', 403);
  const parsed = z.object({ jurisdictionCode: z.string().length(2).regex(/^[A-Z]{2}$/), packCode: z.string().trim().min(4).max(80).regex(/^[A-Z0-9-]+$/), versionNo: z.number().int().positive(), title: z.string().trim().min(5).max(200), effectiveFrom: z.string().date(), effectiveUntil: z.string().date().optional(), sourceRegister: z.array(z.object({ reference: z.string().min(8).max(500), uri: z.string().url() })).min(1) }).refine(v=>!v.effectiveUntil||v.effectiveUntil>=v.effectiveFrom).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;
  const created = await pool.query(`INSERT INTO excise_rule_packs(jurisdiction_code,pack_code,version_no,title,status,effective_from,effective_until,source_register)
    VALUES($1,$2,$3,$4,'DRAFT',$5,$6,$7::jsonb) RETURNING *`, [d.jurisdictionCode,d.packCode,d.versionNo,d.title,d.effectiveFrom,d.effectiveUntil ?? null,JSON.stringify(d.sourceRegister)]);
  await pool.query(`INSERT INTO excise_rule_pack_audit(rule_pack_id,actor_user_id,action,reason,metadata) VALUES($1,$2,'CREATED','Created draft rule pack',$3)`, [created.rows[0].id,req.auth!.userId,{status:'DRAFT',sourceCount:d.sourceRegister.length}]);
  res.status(201).json({ data: created.rows[0] });
});

exciseComplianceRouter.get('/excise/rule-packs', requirePermission('excise:read'), async (_req, res) => {
  const result = await pool.query(`SELECT p.*,COUNT(r.id)::int AS rule_count FROM excise_rule_packs p LEFT JOIN excise_rule_pack_rules r ON r.rule_pack_id=p.id
    GROUP BY p.id ORDER BY p.jurisdiction_code,p.version_no DESC`);
  res.json({ data: result.rows });
});

exciseComplianceRouter.get('/excise/rule-packs/:packId/rules', requirePermission('excise:read'), async (req: any, res: any) => {
  if (!uuid.safeParse(req.params.packId).success) return fail(res, 'INVALID_PACK_ID', 'Invalid rule pack ID');
  const result = await pool.query('SELECT rule_key,rule_value,source_reference,source_uri FROM excise_rule_pack_rules WHERE rule_pack_id=$1 ORDER BY rule_key', [req.params.packId]);
  res.json({ data: result.rows });
});

exciseComplianceRouter.post('/excise/rule-packs/:packId/rules', requirePermission('excise:manage-rules'), async (req: any, res: any) => {
  if (!req.auth!.isPlatformAdmin) return fail(res, 'PLATFORM_ADMIN_REQUIRED', 'Only platform administrators can edit legal rules', 403);
  if (!uuid.safeParse(req.params.packId).success) return fail(res, 'INVALID_PACK_ID', 'Invalid rule pack ID');
  const parsed = z.object({ ruleKey: z.string().trim().regex(/^[A-Z][A-Z0-9_]{2,80}$/), ruleValue: z.record(z.any()), sourceReference: z.string().trim().min(8).max(500), sourceUri: z.string().url().optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const pack = await pool.query("SELECT id FROM excise_rule_packs WHERE id=$1 AND status='DRAFT'", [req.params.packId]);
  if (!pack.rowCount) return fail(res, 'PACK_IMMUTABLE', 'Only draft rule packs can be edited', 409);
  const result = await pool.query(`INSERT INTO excise_rule_pack_rules(rule_pack_id,rule_key,rule_value,source_reference,source_uri)
    VALUES($1,$2,$3::jsonb,$4,$5) ON CONFLICT(rule_pack_id,rule_key) DO UPDATE SET rule_value=EXCLUDED.rule_value,source_reference=EXCLUDED.source_reference,source_uri=EXCLUDED.source_uri
    RETURNING *`, [req.params.packId,parsed.data.ruleKey,JSON.stringify(parsed.data.ruleValue),parsed.data.sourceReference,parsed.data.sourceUri ?? null]);
  await pool.query(`INSERT INTO excise_rule_pack_audit(rule_pack_id,actor_user_id,action,reason,metadata) VALUES($1,$2,'RULE_UPSERT',$3,$4::jsonb)`, [req.params.packId,req.auth!.userId,parsed.data.sourceReference,JSON.stringify({ruleKey:parsed.data.ruleKey,sourceUri:parsed.data.sourceUri ?? null})]);
  res.status(201).json({ data: result.rows[0] });
});

exciseComplianceRouter.post('/excise/rule-packs/:packId/submit', requirePermission('excise:manage-rules'), async (req: any, res: any) => {
  if (!req.auth!.isPlatformAdmin) return fail(res, 'PLATFORM_ADMIN_REQUIRED', 'Only platform administrators can submit legal rule packs', 403);
  if (!uuid.safeParse(req.params.packId).success) return fail(res, 'INVALID_PACK_ID', 'Invalid rule pack ID');
  const updated = await pool.query(`UPDATE excise_rule_packs SET status='PENDING_REVIEW',submitted_by=$1,submitted_at=NOW(),reviewed_by=NULL,reviewed_at=NULL,review_notes=NULL
    WHERE id=$2 AND status IN ('DRAFT','REJECTED') RETURNING *`, [req.auth!.userId, req.params.packId]);
  if (!updated.rowCount) return fail(res, 'PACK_NOT_SUBMITTABLE', 'Only a draft or rejected pack can be submitted', 409);
  await pool.query(`INSERT INTO excise_rule_pack_audit(rule_pack_id,actor_user_id,action,reason,metadata) VALUES($1,$2,'SUBMITTED','Submitted for independent legal review',$3::jsonb)`, [req.params.packId,req.auth!.userId,JSON.stringify({status:'PENDING_REVIEW'})]);
  res.json({ data: updated.rows[0] });
});

exciseComplianceRouter.post('/excise/rule-packs/:packId/review', requirePermission('excise:review-rules'), async (req: any, res: any) => {
  if (!req.auth!.isPlatformAdmin) return fail(res, 'PLATFORM_ADMIN_REQUIRED', 'Legal rule pack review requires platform administration', 403);
  if (!uuid.safeParse(req.params.packId).success) return fail(res, 'INVALID_PACK_ID', 'Invalid rule pack ID');
  const parsed = z.object({ decision: z.enum(['APPROVE','REJECT']), notes: z.string().trim().min(8).max(2000) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const selected = await client.query('SELECT * FROM excise_rule_packs WHERE id=$1 FOR UPDATE', [req.params.packId]);
    if (!selected.rowCount) { await client.query('ROLLBACK'); return fail(res, 'PACK_NOT_FOUND', 'Rule pack not found', 404); }
    const pack = selected.rows[0];
    if (pack.status !== 'PENDING_REVIEW' || pack.submitted_by === req.auth!.userId) { await client.query('ROLLBACK'); return fail(res, 'INDEPENDENT_REVIEW_REQUIRED', 'A different platform administrator must review a submitted rule pack', 403); }
    const next = parsed.data.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    const updated = await client.query(`UPDATE excise_rule_packs SET status=$1,reviewed_by=$2,reviewed_at=NOW(),review_notes=$3 WHERE id=$4 RETURNING *`, [next, req.auth!.userId, parsed.data.notes, pack.id]);
    await client.query(`INSERT INTO audit_events(organisation_id,actor_user_id,event_type,entity_type,entity_id,reason,metadata)
      VALUES(NULL,$1,'EXCISE_RULE_PACK_REVIEWED','EXCISE_RULE_PACK',$2,$3,$4)`, [req.auth!.userId, pack.id, parsed.data.notes, { decision: parsed.data.decision, jurisdiction: pack.jurisdiction_code }]);
    await client.query(`INSERT INTO excise_rule_pack_audit(rule_pack_id,actor_user_id,action,reason,metadata) VALUES($1,$2,'REVIEWED',$3,$4::jsonb)`, [pack.id,req.auth!.userId,parsed.data.notes,JSON.stringify({decision:parsed.data.decision,status:next})]);
    await client.query('COMMIT'); res.json({ data: updated.rows[0] });
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
});

exciseComplianceRouter.post('/excise/rule-packs/:packId/activate', requirePermission('excise:activate-rules'), async (req: any, res: any) => {
  if (!req.auth!.isPlatformAdmin) return fail(res, 'PLATFORM_ADMIN_REQUIRED', 'Only platform administrators can activate legal rule packs', 403);
  if (!uuid.safeParse(req.params.packId).success) return fail(res, 'INVALID_PACK_ID', 'Invalid rule pack ID');
  const parsed = z.object({ confirmation: z.literal('ACTIVATE_APPROVED_LEGAL_PACK') }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const selected = await client.query('SELECT * FROM excise_rule_packs WHERE id=$1 FOR UPDATE', [req.params.packId]);
    if (!selected.rowCount) { await client.query('ROLLBACK'); return fail(res, 'PACK_NOT_FOUND', 'Rule pack not found', 404); }
    const pack = selected.rows[0];
    if (pack.status !== 'APPROVED' || pack.submitted_by === req.auth!.userId || pack.reviewed_by === req.auth!.userId || pack.reviewed_by === pack.submitted_by) {
      await client.query('ROLLBACK'); return fail(res, 'INDEPENDENT_ACTIVATION_REQUIRED', 'Activation requires an approved pack and a third distinct platform administrator', 403);
    }
    await client.query("UPDATE excise_rule_packs SET status='RETIRED' WHERE jurisdiction_code=$1 AND status='ACTIVE'", [pack.jurisdiction_code]);
    const updated = await client.query(`UPDATE excise_rule_packs SET status='ACTIVE',activated_by=$1,activated_at=NOW() WHERE id=$2 RETURNING *`, [req.auth!.userId, pack.id]);
    await client.query(`INSERT INTO audit_events(organisation_id,actor_user_id,event_type,entity_type,entity_id,reason,metadata)
      VALUES(NULL,$1,'EXCISE_RULE_PACK_ACTIVATED','EXCISE_RULE_PACK',$2,'Independent legal rule pack activation',$3)`, [req.auth!.userId, pack.id, { jurisdiction: pack.jurisdiction_code, version: pack.version_no }]);
    await client.query(`INSERT INTO excise_rule_pack_audit(rule_pack_id,actor_user_id,action,reason,metadata) VALUES($1,$2,'ACTIVATED','Independent legal rule pack activation',$3::jsonb)`, [pack.id,req.auth!.userId,JSON.stringify({jurisdiction:pack.jurisdiction_code,version:pack.version_no})]);
    await client.query('COMMIT'); res.json({ data: updated.rows[0], enforcement: 'ACTIVE_FAIL_CLOSED' });
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
});

exciseComplianceRouter.get('/outlets/:outletId/excise/conditions', requirePermission('excise:read'), async (req: any, res: any) => {
  if (!uuid.safeParse(req.params.outletId).success) return fail(res, 'INVALID_OUTLET_ID', 'Invalid outlet ID');
  const result = await pool.query(`SELECT c.*,l.licence_type,l.licence_number FROM outlet_licence_excise_conditions c
    JOIN outlet_licences l ON l.id=c.licence_id WHERE c.organisation_id=$1 AND c.outlet_id=$2 ORDER BY c.created_at DESC`, [org(req), req.params.outletId]);
  res.json({ data: result.rows });
});

exciseComplianceRouter.post('/outlets/:outletId/licences/:licenceId/excise-conditions', requirePermission('excise:manage-conditions'), async (req: any, res: any) => {
  if (!uuid.safeParse(req.params.outletId).success || !uuid.safeParse(req.params.licenceId).success) return fail(res, 'INVALID_ID', 'Invalid outlet or licence ID');
  const parsed = z.object({ weeklyHours: weeklyHoursSchema }).safeParse(req.body);
  if (!parsed.success || Object.keys(parsed.success ? parsed.data.weeklyHours : {}).some(k => !['mon','tue','wed','thu','fri','sat','sun'].includes(k)) || !Object.keys(parsed.success ? parsed.data.weeklyHours : {}).length) return res.status(400).json({ error: 'weeklyHours must contain weekday keys and valid 24-hour open/close times' });
  const licence = await pool.query(`SELECT l.id,l.outlet_id,l.organisation_id,l.status FROM outlet_licences l JOIN outlets o ON o.id=l.outlet_id
    WHERE l.id=$1 AND l.outlet_id=$2 AND l.organisation_id=$3`, [req.params.licenceId, req.params.outletId, org(req)]);
  if (!licence.rowCount) return fail(res, 'LICENCE_NOT_FOUND', 'Licence not found for this organisation/outlet', 404);
  if (licence.rows[0].status !== 'VERIFIED') return fail(res, 'LICENCE_NOT_VERIFIED', 'Only a verified licence can receive operating-hour conditions', 409);
  const inserted = await pool.query(`INSERT INTO outlet_licence_excise_conditions(organisation_id,outlet_id,licence_id,weekly_hours,submitted_by)
    VALUES($1,$2,$3,$4::jsonb,$5) RETURNING *`, [org(req), req.params.outletId, req.params.licenceId, JSON.stringify(parsed.data.weeklyHours), req.auth!.userId]);
  await pool.query(`INSERT INTO audit_events(organisation_id,outlet_id,actor_user_id,event_type,entity_type,entity_id,metadata) VALUES($1,$2,$3,'EXCISE_LICENCE_HOURS_SUBMITTED','OUTLET_LICENCE_CONDITIONS',$4,$5)`, [org(req),req.params.outletId,req.auth!.userId,inserted.rows[0].id,{status:'PENDING_REVIEW'}]);
  res.status(201).json({ data: inserted.rows[0], status: 'PENDING_REVIEW' });
});

exciseComplianceRouter.post('/excise/licence-conditions/:conditionId/review', requirePermission('excise:review-conditions'), async (req: any, res: any) => {
  if (!req.auth!.isPlatformAdmin) return fail(res, 'PLATFORM_ADMIN_REQUIRED', 'Licence condition verification requires platform review', 403);
  if (!uuid.safeParse(req.params.conditionId).success) return fail(res, 'INVALID_CONDITION_ID', 'Invalid licence condition ID');
  const parsed = z.object({ decision: z.enum(['VERIFY','REJECT']), notes: z.string().trim().min(8).max(1000) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const selected = await client.query('SELECT * FROM outlet_licence_excise_conditions WHERE id=$1 FOR UPDATE', [req.params.conditionId]);
    if (!selected.rowCount) { await client.query('ROLLBACK'); return fail(res, 'CONDITION_NOT_FOUND', 'Licence conditions not found', 404); }
    const row = selected.rows[0];
    if (row.status !== 'PENDING_REVIEW' || row.submitted_by === req.auth!.userId) { await client.query('ROLLBACK'); return fail(res, 'INDEPENDENT_REVIEW_REQUIRED', 'A different platform administrator must verify licence hours', 403); }
    const next = parsed.data.decision === 'VERIFY' ? 'VERIFIED' : 'REJECTED';
    if (next === 'VERIFIED') await client.query("UPDATE outlet_licence_excise_conditions SET status='SUPERSEDED' WHERE licence_id=$1 AND status='VERIFIED'", [row.licence_id]);
    const updated = await client.query(`UPDATE outlet_licence_excise_conditions SET status=$1,reviewed_by=$2,reviewed_at=NOW(),review_notes=$3 WHERE id=$4 RETURNING *`, [next, req.auth!.userId, parsed.data.notes, row.id]);
    await client.query(`INSERT INTO audit_events(organisation_id,outlet_id,actor_user_id,event_type,entity_type,entity_id,reason,metadata)
      VALUES($1,$2,$3,'EXCISE_LICENCE_HOURS_REVIEWED','OUTLET_LICENCE_CONDITIONS',$4,$5,$6)`, [row.organisation_id,row.outlet_id,req.auth!.userId,row.id,parsed.data.notes,{decision:parsed.data.decision}]);
    await client.query('COMMIT'); res.json({ data: updated.rows[0] });
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
});

exciseComplianceRouter.post('/excise/dry-day-orders', requirePermission('excise:manage-dry-days'), async (req: any, res: any) => {
  if (!req.auth!.isPlatformAdmin) return fail(res, 'PLATFORM_ADMIN_REQUIRED', 'Dry-day orders require platform administration', 403);
  const parsed = z.object({ jurisdictionCode: z.literal('KA'), dryDayDate: z.string().date(), district: z.string().trim().min(2).max(100).optional(), orderReference: z.string().trim().min(3).max(160), sourceUri: z.string().url(), reason: z.string().trim().min(8).max(1000) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;
  const inserted = await pool.query(`INSERT INTO excise_dry_day_orders(jurisdiction_code,dry_day_date,district,order_reference,source_uri,reason,submitted_by)
    VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(jurisdiction_code,dry_day_date,district,order_reference) DO NOTHING RETURNING *`, [d.jurisdictionCode,d.dryDayDate,d.district ?? null,d.orderReference,d.sourceUri,d.reason,req.auth!.userId]);
  if (!inserted.rowCount) return fail(res, 'DRY_DAY_ORDER_EXISTS', 'This dry-day order is already registered', 409);
  await pool.query(`INSERT INTO excise_dry_day_order_audit(dry_day_order_id,actor_user_id,action,reason) VALUES($1,$2,'SUBMITTED',$3)`, [inserted.rows[0].id,req.auth!.userId,d.reason]);
  res.status(201).json({ data: inserted.rows[0], status: 'PENDING_REVIEW' });
});

exciseComplianceRouter.get('/excise/dry-day-orders', requirePermission('excise:read'), async (_req, res) => {
  const result = await pool.query("SELECT * FROM excise_dry_day_orders WHERE jurisdiction_code='KA' ORDER BY dry_day_date DESC LIMIT 250");
  res.json({ data: result.rows });
});

exciseComplianceRouter.post('/excise/dry-day-orders/:orderId/review', requirePermission('excise:review-dry-days'), async (req: any, res: any) => {
  if (!req.auth!.isPlatformAdmin) return fail(res, 'PLATFORM_ADMIN_REQUIRED', 'Dry-day order verification requires platform review', 403);
  if (!uuid.safeParse(req.params.orderId).success) return fail(res, 'INVALID_ORDER_ID', 'Invalid dry-day order ID');
  const parsed = z.object({ decision: z.enum(['APPROVE','REJECT']), notes: z.string().trim().min(8).max(1000) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query('SELECT * FROM excise_dry_day_orders WHERE id=$1 FOR UPDATE', [req.params.orderId]);
    if (!found.rowCount) { await client.query('ROLLBACK'); return fail(res, 'DRY_DAY_ORDER_NOT_FOUND', 'Dry-day order not found', 404); }
    const order = found.rows[0];
    if (order.status !== 'PENDING_REVIEW' || order.submitted_by === req.auth!.userId) { await client.query('ROLLBACK'); return fail(res, 'INDEPENDENT_REVIEW_REQUIRED', 'A different platform administrator must review the dry-day order', 403); }
    const next = parsed.data.decision === 'APPROVE' ? 'ACTIVE' : 'REJECTED';
    const updated = await client.query('UPDATE excise_dry_day_orders SET status=$1,reviewed_by=$2,reviewed_at=NOW(),review_notes=$3 WHERE id=$4 RETURNING *', [next,req.auth!.userId,parsed.data.notes,req.params.orderId]);
    await client.query(`INSERT INTO excise_dry_day_order_audit(dry_day_order_id,actor_user_id,action,reason) VALUES($1,$2,$3,$4)`, [order.id,req.auth!.userId,next==='ACTIVE'?'APPROVED':'REJECTED',parsed.data.notes]);
    await client.query('COMMIT'); res.json({ data: updated.rows[0] });
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
});

exciseComplianceRouter.post('/excise/evaluate', requirePermission('excise:evaluate'), async (req: any, res: any) => {
  const parsed = z.object({ outletId: uuid, channel: z.enum(['RETAIL','BAR']), occurredAt: z.string().datetime().optional(), attestations: z.object({ ageVerified: z.boolean(), notIntoxicated: z.boolean(), noRestrictedCustomer: z.boolean(), mealProvided: z.boolean().optional(), consumptionOnPremises: z.boolean().optional() }) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const result = await evaluateExciseSale(pool, { organisationId: org(req), outletId: parsed.data.outletId, channel: parsed.data.channel, occurredAt: parsed.data.occurredAt, attestations: parsed.data.attestations, sourceType: 'PREVIEW', actorUserId: req.auth!.userId });
  res.status(result.allowed ? 200 : 409).json({ data: result, message: result.allowed ? 'Compliance checks passed' : 'Sale is blocked by excise compliance controls' });
});

exciseComplianceRouter.get('/excise/decisions', requirePermission('excise:read'), async (req: any, res: any) => {
  const result = await pool.query(`SELECT d.*,p.pack_code,l.licence_type FROM excise_compliance_decisions d
    LEFT JOIN excise_rule_packs p ON p.id=d.rule_pack_id LEFT JOIN outlet_licences l ON l.id=d.licence_id
    WHERE d.organisation_id=$1 ORDER BY d.evaluated_at DESC LIMIT 250`, [org(req)]);
  res.json({ data: result.rows });
});
