import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { requireOrgScope } from '../middleware/requireOrgScope.js';
import { evaluateExciseSale } from '../services/exciseCompliance.js';

export const offlineAuthoritativeRouter = Router();
offlineAuthoritativeRouter.use(authenticate, requireOrgScope);
const org = (req: any) => req.auth.organisationId as string;
const uuid = z.string().uuid();
const fail = (res: any, code: string, message: string, status = 400) => res.status(status).json({ error: { code, message } });

type Check = { key: string; passed: boolean; detail: string; evidence?: unknown };

// Current server records are authoritative. A passing check creates evidence only;
// no sale, payment, inventory movement, tax posting or journal is created here.
offlineAuthoritativeRouter.post('/offline/posting-intents/:intentId/authoritative-check', requirePermission('offline:authoritative-check'), async (req: any, res: any) => {
  if (!uuid.safeParse(req.params.intentId).success) return fail(res, 'INVALID_INTENT_ID', 'Invalid posting intent ID');
  const parsed = z.object({ notes: z.string().trim().min(8).max(500) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const selected = await client.query(`SELECT i.*,e.payload,e.device_id,e.status AS event_status,o.status AS outlet_status,o.state_code,o.operating_mode,
      org.status AS organisation_status FROM offline_posting_intents i
      JOIN offline_sync_events e ON e.id=i.event_row_id
      JOIN outlets o ON o.id=i.outlet_id AND o.organisation_id=i.organisation_id
      JOIN organisations org ON org.id=i.organisation_id
      WHERE i.id=$1 AND i.organisation_id=$2 FOR UPDATE OF i,e`, [req.params.intentId, org(req)]);
    if (!selected.rowCount) { await client.query('ROLLBACK'); return fail(res, 'INTENT_NOT_FOUND', 'Posting intent not found', 404); }
    const intent = selected.rows[0];
    if (intent.status !== 'READY_FOR_POST') { await client.query('ROLLBACK'); return fail(res, 'INTENT_NOT_READY', `Intent status ${intent.status} cannot be checked`, 409); }
    const prior = await client.query('SELECT id,outcome FROM offline_authoritative_checks WHERE posting_intent_id=$1', [intent.id]);
    if (prior.rowCount) { await client.query('ROLLBACK'); return fail(res, 'CHECK_ALREADY_RECORDED', 'Authoritative check evidence is immutable; resolve the source event and submit a new event if it changes', 409); }
    const payload = intent.payload as Record<string, any>;
    const checks: Check[] = [];
    const add = (key: string, passed: boolean, detail: string, evidence?: unknown) => checks.push({ key, passed, detail, ...(evidence === undefined ? {} : { evidence }) });
    add('supported_transaction_type', ['RETAIL_SALE','BAR_CHECKOUT'].includes(intent.event_type), 'Only retail sale and bar checkout event types are eligible for this P528 validation path', intent.event_type);
    add('organisation_active', intent.organisation_status === 'ACTIVE', 'Organisation must currently be ACTIVE', intent.organisation_status);
    add('outlet_active', intent.outlet_status === 'ACTIVE', 'Outlet must currently be ACTIVE', { status: intent.outlet_status, stateCode: intent.state_code });

    const capability = intent.event_type === 'BAR_CHECKOUT' ? 'BAR_SERVICE' : 'RETAIL_SALE';
    const modeAllows = capability === 'RETAIL_SALE' ? ['RETAIL_ONLY','HYBRID'].includes(intent.operating_mode) : ['BAR_ONLY','HYBRID'].includes(intent.operating_mode);
    add('outlet_operating_mode', modeAllows, `Outlet operating mode must permit ${capability}`, intent.operating_mode);
    const licence = await client.query(`SELECT id,licence_type,status,valid_from,valid_until,permitted_activities
      FROM outlet_licences WHERE outlet_id=$1 AND organisation_id=$2 AND status='VERIFIED'
      AND (valid_from IS NULL OR valid_from<=CURRENT_DATE) AND (valid_until IS NULL OR valid_until>=CURRENT_DATE)
      ORDER BY created_at DESC`, [intent.outlet_id, org(req)]);
    const matchingLicence = licence.rows.find((row: any) => Array.isArray(row.permitted_activities) && row.permitted_activities.includes(capability));
    add('verified_current_licence', !!matchingLicence, `A current verified outlet licence explicitly permitting ${capability} is required`, licence.rows.map((row: any) => ({ id: row.id, type: row.licence_type, status: row.status, validFrom: row.valid_from, validUntil: row.valid_until, capabilities: row.permitted_activities })));
    const timestampValid = typeof payload.occurredAt === 'string' && Number.isFinite(Date.parse(payload.occurredAt)) && /(Z|[+-]\d{2}:\d{2})$/i.test(payload.occurredAt);
    const timeProof = timestampValid ? await client.query(`SELECT id FROM offline_device_time_attestations WHERE organisation_id=$1 AND device_id=$2 AND event_row_id=$3
      AND occurred_at=$4::timestamptz AND verification_status='VERIFIED'`, [org(req),intent.device_id,intent.event_row_id,payload.occurredAt]) : { rowCount: 0, rows: [] as any[] };
    const excise = await evaluateExciseSale(client, { organisationId: org(req), outletId: intent.outlet_id, channel: intent.event_type === 'BAR_CHECKOUT' ? 'BAR' : 'RETAIL', occurredAt: payload.occurredAt, attestations: payload.complianceAttestations, sourceType: 'PREVIEW', sourceReference: intent.id, actorUserId: req.auth!.userId });
    add('offline_transaction_timestamp', timestampValid && typeof payload.occurredAt === 'string' && /(Z|[+-]\d{2}:\d{2})$/i.test(payload.occurredAt), 'Offline event must carry an offset-aware device occurrence timestamp', payload.occurredAt);
    add('offline_secure_time_attestation', !!timeProof.rowCount, 'A server-verified hardware-backed device-time attestation is required for statutory trading-hour and dry-day evaluation', timeProof.rows[0]?.id ?? null);
    add('excise_regulatory_compliance', excise.allowed && timestampValid, excise.allowed ? 'Current approved jurisdictional excise rules and verified licence conditions passed' : 'Excise sale is blocked until all active jurisdictional rules, licence hours and customer attestations pass', { decisionId: excise.decisionId, reasons: excise.reasonCodes, rulePackId: excise.rulePackId, licenceId: excise.licenceId });

    const items = Array.isArray(payload.items) ? payload.items : [];
    add('non_empty_items', items.length > 0 && items.length <= 200, 'Transaction must contain between 1 and 200 lines');
    const productIds = [...new Set(items.map((line: any) => line.productId).filter((id: unknown) => typeof id === 'string' && uuid.safeParse(id).success))];
    const productRows = productIds.length ? await client.query(`SELECT id,sku,name,status FROM products WHERE organisation_id=$1 AND id=ANY($2::uuid[])`, [org(req), productIds]) : { rows: [] as any[] };
    const productMap = new Map(productRows.rows.map((row: any) => [row.id, row]));
    const allProductsActive = items.length > 0 && items.every((line: any) => {
      const product: any = productMap.get(line.productId);
      return !!product && product.status === 'ACTIVE' && uuid.safeParse(line.productId).success && Number.isSafeInteger(line.quantity) && line.quantity > 0;
    });
    add('products_active_and_owned', allProductsActive, 'Every line must reference an ACTIVE product belonging to this organisation', productRows.rows.map((p: any) => ({ id: p.id, sku: p.sku, status: p.status })));

    let allPricesCurrent = items.length > 0;
    const priceEvidence: unknown[] = [];
    for (const line of items) {
      if (typeof line.productId !== 'string') { allPricesCurrent = false; continue; }
      const channel = intent.event_type === 'BAR_CHECKOUT' ? (line.lineType === 'PEG' ? 'BAR_PEG' : line.lineType === 'BOTTLE' ? 'BAR_BOTTLE' : 'BAR_PACKAGED') : 'RETAIL';
      const volume = channel === 'BAR_PEG' ? Number(line.volumeMl) : null;
      const price = await client.query(`SELECT unit_price,tax_rate,effective_from FROM outlet_product_prices
        WHERE organisation_id=$1 AND outlet_id=$2 AND product_id=$3 AND channel=$4
        AND (($5::integer IS NULL AND volume_ml IS NULL) OR volume_ml=$5)
        AND effective_from<=NOW() AND (effective_until IS NULL OR effective_until>NOW())
        ORDER BY effective_from DESC LIMIT 1`, [org(req), intent.outlet_id, line.productId, channel, Number.isInteger(volume) && volume > 0 ? volume : null]);
      const current = price.rows[0];
      const expectedMinor = Number.isSafeInteger(line.unitPriceMinor) ? line.unitPriceMinor : null;
      const matches = !!current && expectedMinor !== null && Math.round(Number(current.unit_price) * 100) === expectedMinor;
      allPricesCurrent = allPricesCurrent && matches;
      priceEvidence.push({ productId: line.productId, channel, currentPriceMinor: current ? Math.round(Number(current.unit_price) * 100) : null, submittedPriceMinor: expectedMinor, matches });
    }
    add('current_outlet_prices_match', allPricesCurrent, 'Each line must carry unitPriceMinor matching the current server-authoritative outlet price', priceEvidence);

    if (intent.event_type === 'RETAIL_SALE') {
      let stockOk = items.length > 0;
      const stockEvidence: unknown[] = [];
      for (const line of items) {
        const stock = await client.query('SELECT quantity_units FROM stock_balances WHERE organisation_id=$1 AND outlet_id=$2 AND product_id=$3', [org(req), intent.outlet_id, line.productId]);
        const available = stock.rowCount ? Number(stock.rows[0].quantity_units) : 0;
        const enough = available >= Number(line.quantity);
        stockOk = stockOk && enough;
        stockEvidence.push({ productId: line.productId, requested: line.quantity, available, enough });
      }
      add('retail_stock_available', stockOk, 'Current outlet stock must cover each retail sale line', stockEvidence);
    } else {
      let barInventoryOk = items.length > 0;
      const inventoryEvidence: unknown[] = [];
      for (const line of items) {
        const lineType = line.lineType;
        if (!['PEG','BOTTLE','PACKAGED'].includes(String(lineType)) || !Number.isSafeInteger(line.quantity) || Number(line.quantity) <= 0) {
          barInventoryOk = false;
          inventoryEvidence.push({ productId: line.productId, validLine: false, reason: 'Invalid line type or quantity' });
          continue;
        }
        if (lineType === 'PEG') {
          const volumeMl = Number(line.volumeMl);
          const bottle = typeof line.openBottleId === 'string' && uuid.safeParse(line.openBottleId).success && Number.isSafeInteger(volumeMl) && volumeMl > 0
            ? await client.query(`SELECT b.id,b.remaining_ml,b.status,COALESCE((SELECT SUM(r.reserved_ml-r.consumed_ml) FROM bar_bottle_reservations r WHERE r.open_bottle_id=b.id AND r.status='ACTIVE' AND r.expires_at>NOW()),0)::int reserved_ml FROM open_bottles b WHERE b.id=$1 AND b.organisation_id=$2 AND b.outlet_id=$3 AND b.product_id=$4`, [line.openBottleId, org(req), intent.outlet_id, line.productId])
            : { rows: [] as any[] };
          const requiredMl = volumeMl * Number(line.quantity);
          const availableMl = bottle.rows[0] ? Number(bottle.rows[0].remaining_ml)-Number(bottle.rows[0].reserved_ml) : 0;
          const enough = !!bottle.rows[0] && bottle.rows[0].status === 'OPEN' && availableMl >= requiredMl;
          barInventoryOk = barInventoryOk && enough;
          inventoryEvidence.push({ productId: line.productId, lineType, openBottleId: line.openBottleId, requiredMl, availableMl, enough });
        } else {
          const stock = await client.query('SELECT quantity_units FROM stock_balances WHERE organisation_id=$1 AND outlet_id=$2 AND product_id=$3', [org(req), intent.outlet_id, line.productId]);
          const available = stock.rowCount ? Number(stock.rows[0].quantity_units) : 0;
          const enough = available >= Number(line.quantity);
          barInventoryOk = barInventoryOk && enough;
          inventoryEvidence.push({ productId: line.productId, lineType, requested: line.quantity, available, enough });
        }
      }
      add('bar_measure_and_stock_available', barInventoryOk, 'PEG lines require an outlet/product-scoped open bottle with sufficient millilitres; BOTTLE and PACKAGED lines require sufficient stock units', inventoryEvidence);
    }

    const totalMinor = Number.isSafeInteger(payload.totalMinor) ? payload.totalMinor : null;
    const paymentMinor = Array.isArray(payload.payments) ? payload.payments.reduce((sum: number, p: any) => sum + (Number.isSafeInteger(p.amountMinor) ? p.amountMinor : 0), 0) : 0;
    add('payment_allocation_matches_total', totalMinor !== null && paymentMinor === totalMinor && Array.isArray(payload.payments) && payload.payments.length > 0, 'Payment allocation evidence must sum exactly to the submitted total', { totalMinor, paymentMinor });

    const passed = checks.every(c => c.passed);
    const outcome = passed ? 'PASS' : 'FAIL';
    await client.query(`INSERT INTO offline_authoritative_checks(organisation_id,outlet_id,posting_intent_id,event_row_id,checked_by,outcome,checks,notes)
      VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`, [org(req), intent.outlet_id, intent.id, intent.event_row_id, req.auth!.userId, outcome, JSON.stringify(checks), parsed.data.notes]);
    if (!passed) await client.query("UPDATE offline_posting_intents SET status='HELD' WHERE id=$1", [intent.id]);
    await client.query(`INSERT INTO offline_sync_audit(organisation_id,batch_id,actor_user_id,action,details)
      SELECT $1,e.batch_id,$2,'AUTHORITATIVE_CHECK',$3::jsonb FROM offline_sync_events e WHERE e.id=$4`, [org(req), req.auth!.userId, JSON.stringify({ eventId: intent.event_id, intentId: intent.id, outcome, checks }), intent.event_row_id]);
    await client.query('COMMIT');
    res.json({ data: { intentId: intent.id, outcome, status: passed ? 'READY_FOR_POST' : 'HELD', checks, ledgerPosting: 'NOT_EXECUTED' }, note: 'Authoritative checks are evidence only. No ledger posting was executed.' });
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
});

offlineAuthoritativeRouter.get('/offline/authoritative-checks', requirePermission('offline:authoritative-read'), async (req: any, res: any) => {
  const result = await pool.query(`SELECT c.id,c.posting_intent_id,c.event_row_id,c.outcome,c.checks,c.notes,c.created_at,c.checked_by
    FROM offline_authoritative_checks c WHERE c.organisation_id=$1 ORDER BY c.created_at DESC LIMIT 250`, [org(req)]);
  res.json({ data: result.rows, ledgerPosting: 'NOT_EXECUTED' });
});
