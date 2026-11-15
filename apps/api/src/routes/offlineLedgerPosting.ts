import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { appendStockMovementOnce } from '../services/stockMovementIdempotency.js';
import { consumeInventoryBatchFefo } from '../services/inventoryBatchFefo.js';
import { authenticate } from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { requireOrgScope } from '../middleware/requireOrgScope.js';
import { barLineTaxMinor, pegConsumedMl, unreservedBottleMl } from '../services/barMeasureRules.js';
import { evaluateExciseSale } from '../services/exciseCompliance.js';

export const offlineLedgerPostingRouter = Router();
offlineLedgerPostingRouter.use(authenticate, requireOrgScope);
const org = (req: any) => req.auth.organisationId as string;
const uuid = z.string().uuid();
const fail = (res: any, code: string, message: string, status = 400) => res.status(status).json({ error: { code, message } });

// P530/P531 transactional offline posting: retail units and measure-aware bar depletion.
offlineLedgerPostingRouter.post('/offline/posting-intents/:intentId/post', requirePermission('offline:ledger-post'), async (req: any, res: any) => {
  if (!uuid.safeParse(req.params.intentId).success) return fail(res, 'INVALID_INTENT_ID', 'Invalid posting intent ID');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const selected = await client.query(`SELECT i.*,e.payload,e.payload_hash AS event_payload_hash,e.event_type AS source_type,
      e.event_id AS source_event_id,e.batch_id,e.device_id,e.status AS event_status,a.outcome AS approval_outcome,
      v.outcome AS validation_outcome,c.outcome AS authoritative_outcome
      FROM offline_posting_intents i JOIN offline_sync_events e ON e.id=i.event_row_id
      JOIN offline_posting_approvals a ON a.posting_intent_id=i.id
      JOIN offline_event_validations v ON v.event_row_id=e.id
      JOIN offline_authoritative_checks c ON c.posting_intent_id=i.id
      WHERE i.id=$1 AND i.organisation_id=$2 FOR UPDATE OF i,e`, [req.params.intentId, org(req)]);
    if (!selected.rowCount) { await client.query('ROLLBACK'); return fail(res, 'INTENT_NOT_FOUND_OR_UNVERIFIED', 'Posting intent or required approval/check evidence not found', 404); }
    const intent = selected.rows[0];
    const prior = await client.query('SELECT outcome,sale_id,bar_ticket_id,reason_code FROM offline_posting_executions WHERE posting_intent_id=$1', [intent.id]);
    if (prior.rowCount) {
      await client.query('COMMIT');
      if (prior.rows[0].outcome === 'BLOCKED') return res.status(409).json({ error: { code: prior.rows[0].reason_code ?? 'POSTING_BLOCKED', message: 'This posting intent has a recorded terminal block. Submit a corrected new source event after resolving the cause.' }, data: prior.rows[0], idempotentReplay: true, ledgerPosting: 'NOT_EXECUTED' });
      return res.json({ data: prior.rows[0], idempotentReplay: true });
    }
    if (intent.status !== 'AUTHORIZED_TO_POST' || intent.approval_outcome !== 'APPROVE' || intent.validation_outcome !== 'PASS' || intent.authoritative_outcome !== 'PASS') {
      await client.query('ROLLBACK'); return fail(res, 'POSTING_NOT_AUTHORIZED', 'Intent must have passing structural and authoritative checks and an independent approval', 409);
    }
    const payload = intent.payload as Record<string, any>;
    const block = async (reason: string, message: string) => {
      const blockedExecution = await client.query(`INSERT INTO offline_posting_executions(organisation_id,outlet_id,posting_intent_id,event_row_id,outcome,reason_code,payload_hash)
        VALUES($1,$2,$3,$4,'BLOCKED',$5,$6) RETURNING id`, [org(req), intent.outlet_id, intent.id, intent.event_row_id, reason, intent.payload_hash]);
      const recoveryCase = await client.query(`INSERT INTO offline_recovery_cases(organisation_id,outlet_id,execution_id,posting_intent_id,event_row_id,case_type,reason_code,description,created_by)
        VALUES($1,$2,$3,$4,$5,'POSTING_BLOCK',$6,$7,$8) ON CONFLICT(execution_id) DO NOTHING RETURNING id`,
        [org(req), intent.outlet_id, blockedExecution.rows[0].id, intent.id, intent.event_row_id, reason, `Automatic recovery case for blocked offline posting: ${message}`.slice(0,1000), req.auth!.userId]);
      if (recoveryCase.rowCount) {
        const caseId = recoveryCase.rows[0].id;
        const description = `Automatic recovery case opened for ${reason}`;
        await client.query(`INSERT INTO offline_recovery_actions(organisation_id,case_id,actor_user_id,action,reason,metadata)
          VALUES($1,$2,$3,'CASE_OPENED',$4,$5::jsonb)`, [org(req), caseId, req.auth!.userId, description, JSON.stringify({ executionId: blockedExecution.rows[0].id, automatic: true })]);
        await client.query(`INSERT INTO offline_sync_audit(organisation_id,batch_id,actor_user_id,action,details)
          VALUES($1,$2,$3,'RECOVERY_CASE_OPENED',$4::jsonb)`, [org(req), intent.batch_id, req.auth!.userId, JSON.stringify({ caseId, executionId: blockedExecution.rows[0].id, reason })]);
      }
      await client.query("UPDATE offline_posting_intents SET status='HELD' WHERE id=$1", [intent.id]);
      await client.query("UPDATE offline_sync_events SET status='CONFLICT' WHERE id=$1", [intent.event_row_id]);
      await client.query(`INSERT INTO offline_sync_audit(organisation_id,batch_id,actor_user_id,action,details)
        VALUES($1,$2,$3,'LEDGER_POST_BLOCKED',$4::jsonb)`, [org(req), intent.batch_id, req.auth!.userId, JSON.stringify({ intentId: intent.id, reason, terminal: true })]);
      await client.query('COMMIT');
      return res.status(409).json({ error: { code: reason, message }, ledgerPosting: 'NOT_EXECUTED' });
    };
    if (!['RETAIL_SALE','BAR_CHECKOUT'].includes(intent.event_type)) return await block('UNSUPPORTED_POSTING_TYPE', 'Only retail sale and bar checkout events can be posted.');
    if (!Array.isArray(payload.items) || !Array.isArray(payload.payments) || !Number.isSafeInteger(payload.totalMinor) || payload.totalMinor <= 0) return await block('INVALID_FINANCIAL_ENVELOPE', 'Sale payload is incomplete or invalid.');
    const paymentTotal = payload.payments.reduce((sum: number, p: any) => sum + (Number.isSafeInteger(p.amountMinor) ? p.amountMinor : 0), 0);
    if (paymentTotal !== payload.totalMinor || payload.payments.some((p: any) => !['CASH','UPI','CARD','WALLET','OTHER'].includes(p.method) || !Number.isSafeInteger(p.amountMinor) || p.amountMinor <= 0)) return await block('PAYMENT_ALLOCATION_MISMATCH', 'Payment allocations must be positive, supported and exactly equal the sale total.');
    const outlet = await client.query(`SELECT o.status,o.organisation_id,org.status AS org_status FROM outlets o JOIN organisations org ON org.id=o.organisation_id WHERE o.id=$1 AND o.organisation_id=$2 FOR UPDATE OF o`, [intent.outlet_id, org(req)]);
    if (!outlet.rowCount || outlet.rows[0].status !== 'ACTIVE' || outlet.rows[0].org_status !== 'ACTIVE') return await block('OUTLET_NOT_ACTIVE', 'Outlet and organisation must remain active at posting time.');
    if (typeof payload.occurredAt !== 'string' || !Number.isFinite(Date.parse(payload.occurredAt)) || !/(Z|[+-]\d{2}:\d{2})$/i.test(payload.occurredAt)) return await block('INVALID_TRANSACTION_TIMESTAMP', 'Offline alcohol transaction requires an offset-aware device occurrence timestamp.');
    // P525 enrolment currently has no cryptographic secure-clock attestation. Do not rely on a client-supplied clock for statutory trading-hour/dry-day decisions.
    const timeProof = await client.query(`SELECT id FROM offline_device_time_attestations WHERE organisation_id=$1 AND device_id=$2 AND event_row_id=$3
      AND occurred_at=$4::timestamptz AND verification_status='VERIFIED' FOR SHARE`, [org(req),intent.device_id,intent.event_row_id,payload.occurredAt]);
    if (!timeProof.rowCount) return await block('OFFLINE_EXCISE_TIME_TRUST_UNAVAILABLE', 'Offline alcohol posting is paused until P538 supplies verifiable device-time attestation.');
    const compliance = await evaluateExciseSale(client, { organisationId: org(req), outletId: intent.outlet_id, channel: intent.event_type === 'BAR_CHECKOUT' ? 'BAR' : 'RETAIL', occurredAt: payload.occurredAt, attestations: payload.complianceAttestations, sourceType: intent.event_type === 'BAR_CHECKOUT' ? 'OFFLINE_BAR' : 'OFFLINE_RETAIL', sourceReference: intent.source_event_id, actorUserId: req.auth!.userId });
    if (!compliance.allowed) return await block('EXCISE_COMPLIANCE_BLOCKED', `Offline sale blocked by current excise rules: ${compliance.reasonCodes.join(', ')}`);

    if (intent.event_type === 'BAR_CHECKOUT') {
      if (!Array.isArray(payload.items) || payload.items.length < 1 || payload.items.length > 200) return await block('INVALID_BAR_LINES', 'Bar checkout requires 1–200 lines.');
      const resolved: Array<{ productId: string; lineType: 'PEG'|'BOTTLE'|'PACKAGED'; quantity: number; volumeMl?: number; openBottleId?: string; unitPrice: number; taxRate: number; taxAmount: number; lineTotal: number }> = [];
      let subtotalMinor = 0; let taxMinor = 0;
      for (const line of payload.items) {
        if (!uuid.safeParse(line.productId).success || !['PEG','BOTTLE','PACKAGED'].includes(line.lineType) || !Number.isSafeInteger(line.quantity) || line.quantity <= 0 || !Number.isSafeInteger(line.unitPriceMinor) || line.unitPriceMinor <= 0) return await block('INVALID_BAR_LINE', 'Each bar line requires a valid product, line type, positive whole quantity and unit price in paise.');
        if (line.lineType === 'PEG' && (!Number.isSafeInteger(line.volumeMl) || line.volumeMl <= 0 || !uuid.safeParse(line.openBottleId).success)) return await block('INVALID_PEG_ALLOCATION', 'PEG lines require a positive volume in millilitres and an open bottle ID.');
        if (line.lineType !== 'PEG' && (line.volumeMl != null || line.openBottleId != null)) return await block('INVALID_PACKAGED_ALLOCATION', 'BOTTLE and PACKAGED lines cannot reference an open bottle or peg measure.');
        const channel = line.lineType === 'PEG' ? 'BAR_PEG' : line.lineType === 'BOTTLE' ? 'BAR_BOTTLE' : 'BAR_PACKAGED';
        const product = await client.query("SELECT id FROM products WHERE id=$1 AND organisation_id=$2 AND status='ACTIVE' FOR UPDATE", [line.productId, org(req)]);
        if (!product.rowCount) return await block('PRODUCT_NOT_ACTIVE', 'Every bar line must reference an active product in this organisation.');
        const price = await client.query(`SELECT unit_price,tax_rate FROM outlet_product_prices
          WHERE organisation_id=$1 AND outlet_id=$2 AND product_id=$3 AND channel=$4
            AND (($5::integer IS NULL AND volume_ml IS NULL) OR volume_ml=$5)
            AND effective_from<=NOW() AND (effective_until IS NULL OR effective_until>NOW())
          ORDER BY effective_from DESC LIMIT 1`, [org(req), intent.outlet_id, line.productId, channel, line.lineType === 'PEG' ? line.volumeMl : null]);
        if (!price.rowCount || Math.round(Number(price.rows[0].unit_price) * 100) !== line.unitPriceMinor) return await block('BAR_PRICE_CHANGED', 'One or more bar prices no longer match the current outlet price book.');
        const unitPrice = Number(price.rows[0].unit_price);
        const taxRate = Number(price.rows[0].tax_rate ?? 0);
        const baseMinor = line.unitPriceMinor * line.quantity;
        const lineTaxMinor = barLineTaxMinor(line.unitPriceMinor, line.quantity, taxRate);
        const lineTotalMinor = baseMinor + lineTaxMinor;
        subtotalMinor += baseMinor; taxMinor += lineTaxMinor;
        resolved.push({ productId: line.productId, lineType: line.lineType, quantity: line.quantity, volumeMl: line.lineType === 'PEG' ? line.volumeMl : undefined, openBottleId: line.lineType === 'PEG' ? line.openBottleId : undefined, unitPrice, taxRate, taxAmount: lineTaxMinor / 100, lineTotal: lineTotalMinor / 100 });
      }
      if (subtotalMinor + taxMinor !== payload.totalMinor) return await block('BAR_TOTAL_MISMATCH', 'Server-derived bar prices and tax do not equal the submitted total.');

      // Lock and validate aggregated inventory before creating any ticket or mutating stock.
      // Aggregation prevents two lines from independently passing against the same bottle/stock row.
      const pegDemand = new Map<string, { productId: string; volumeMl: number }>();
      const stockDemand = new Map<string, number>();
      for (let lineIndex=0;lineIndex<resolved.length;lineIndex++) { const line=resolved[lineIndex];
        if (line.lineType === 'PEG') {
          const key = String(line.openBottleId);
          const prior = pegDemand.get(key) ?? { productId: line.productId, volumeMl: 0 };
          if (prior.productId !== line.productId) return await block('INVALID_PEG_ALLOCATION', 'An open bottle cannot be allocated to different products.');
          prior.volumeMl += pegConsumedMl(Number(line.volumeMl), line.quantity);
          pegDemand.set(key, prior);
        } else stockDemand.set(line.productId, (stockDemand.get(line.productId) ?? 0) + line.quantity);
      }
      for (const [bottleId, demand] of [...pegDemand.entries()].sort(([a],[b]) => a.localeCompare(b))) {
        const bottle = await client.query(`SELECT b.remaining_ml,b.status,COALESCE((SELECT SUM(r.reserved_ml-r.consumed_ml) FROM bar_bottle_reservations r WHERE r.open_bottle_id=b.id AND r.status='ACTIVE' AND r.expires_at>NOW()),0)::int reserved_ml
          FROM open_bottles b WHERE b.id=$1 AND b.organisation_id=$2 AND b.outlet_id=$3 AND b.product_id=$4 FOR UPDATE OF b`, [bottleId,org(req),intent.outlet_id,demand.productId]);
        if (!bottle.rowCount || bottle.rows[0].status !== 'OPEN' || unreservedBottleMl(Number(bottle.rows[0].remaining_ml),Number(bottle.rows[0].reserved_ml)) < demand.volumeMl) return await block('INSUFFICIENT_UNRESERVED_ML', 'An open bottle is unavailable or has insufficient unreserved millilitres for this checkout.');
      }
      for (const [productId, demand] of [...stockDemand.entries()].sort(([a],[b]) => a.localeCompare(b))) {
        const stock = await client.query(`SELECT quantity_units FROM stock_balances WHERE organisation_id=$1 AND outlet_id=$2 AND product_id=$3 FOR UPDATE`, [org(req),intent.outlet_id,productId]);
        if (!stock.rowCount || Number(stock.rows[0].quantity_units) < demand) return await block('INSUFFICIENT_STOCK', `Insufficient aggregate stock for product ${productId}.`);
      }
      const fingerprint = intent.payload_hash;
      const ticketNumber = `OFF-${String(intent.source_event_id)}`.slice(0,60);
      const ticket = await client.query(`INSERT INTO bar_tickets(organisation_id,outlet_id,ticket_number,status,subtotal,tax_total,discount_total,grand_total,opened_by,idempotency_key,request_fingerprint,closed_at)
        VALUES($1,$2,$3,'PAID',$4,$5,0,$6,$7,$8,$9,NOW())
        ON CONFLICT(outlet_id,idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
        RETURNING id,ticket_number,grand_total`, [org(req),intent.outlet_id,ticketNumber,subtotalMinor/100,taxMinor/100,payload.totalMinor/100,req.auth!.userId,intent.source_event_id,fingerprint]);
      if (!ticket.rowCount) {
        const existing = await client.query('SELECT id,ticket_number,grand_total,request_fingerprint FROM bar_tickets WHERE outlet_id=$1 AND idempotency_key=$2', [intent.outlet_id,intent.source_event_id]);
        if (!existing.rowCount || existing.rows[0].request_fingerprint !== fingerprint) return await block('BAR_IDEMPOTENCY_CONFLICT', 'An existing bar ticket uses this event key with different content.');
        await client.query(`INSERT INTO offline_posting_executions(organisation_id,outlet_id,posting_intent_id,event_row_id,bar_ticket_id,outcome,payload_hash) VALUES($1,$2,$3,$4,$5,'POSTED',$6)`, [org(req),intent.outlet_id,intent.id,intent.event_row_id,existing.rows[0].id,intent.payload_hash]);
        await client.query("UPDATE offline_posting_intents SET status='POSTED' WHERE id=$1", [intent.id]);
        await client.query("UPDATE offline_sync_events SET status='POSTED' WHERE id=$1", [intent.event_row_id]);
        await client.query('COMMIT');
        return res.json({ data: existing.rows[0], idempotentReplay: true, inventory: 'BAR_MEASURE_AND_STOCK_POSTED', paymentSettlement: 'PENDING_RECONCILIATION', journals: 'DEFERRED_TO_P536' });
      }
      const ticketId = ticket.rows[0].id;
      await client.query('UPDATE bar_tickets SET excise_decision_id=$1 WHERE id=$2', [compliance.decisionId, ticketId]);
      const kot = await client.query(`INSERT INTO bar_kot_orders(organisation_id,outlet_id,ticket_id,created_by) VALUES($1,$2,$3,$4) RETURNING id`, [org(req),intent.outlet_id,ticketId,req.auth!.userId]);
      for (let lineIndex=0;lineIndex<resolved.length;lineIndex++) { const line=resolved[lineIndex];
        if (line.lineType === 'PEG') {
          const bottle = await client.query(`SELECT id,remaining_ml FROM open_bottles WHERE id=$1 AND organisation_id=$2 AND outlet_id=$3 AND product_id=$4 AND status='OPEN' FOR UPDATE`, [line.openBottleId,org(req),intent.outlet_id,line.productId]);
          if (!bottle.rowCount) throw new Error('Locked open bottle disappeared during bar posting; transaction rolled back');
          const consumedMl = pegConsumedMl(Number(line.volumeMl), line.quantity);
          const remainingMl = Number(bottle.rows[0].remaining_ml) - consumedMl;
          if (remainingMl < 0) throw new Error('Open bottle millilitres changed during bar posting; transaction rolled back');
          await client.query(`UPDATE open_bottles SET remaining_ml=$1,status=$2,closed_at=CASE WHEN $2='EMPTY' THEN NOW() ELSE closed_at END WHERE id=$3`, [remainingMl,remainingMl===0?'EMPTY':'OPEN',line.openBottleId]);
          await client.query(`INSERT INTO peg_transactions(organisation_id,outlet_id,open_bottle_id,product_id,volume_ml,transaction_type,reference_id,notes,performed_by) VALUES($1,$2,$3,$4,$5,'SALE',$6,'P531 offline bar checkout',$7)`, [org(req),intent.outlet_id,line.openBottleId,line.productId,consumedMl,ticketId,req.auth!.userId]);
        } else {
          const stock = await client.query(`SELECT quantity_units FROM stock_balances WHERE organisation_id=$1 AND outlet_id=$2 AND product_id=$3 FOR UPDATE`, [org(req),intent.outlet_id,line.productId]);
          if (!stock.rowCount || Number(stock.rows[0].quantity_units) < line.quantity) throw new Error('Bar stock changed during posting; transaction rolled back');
          const updated = await client.query(`UPDATE stock_balances SET quantity_units=quantity_units-$1,updated_at=NOW() WHERE organisation_id=$2 AND outlet_id=$3 AND product_id=$4 AND quantity_units >= $1 RETURNING quantity_units`, [line.quantity,org(req),intent.outlet_id,line.productId]);
          if (!updated.rowCount) throw new Error('Bar stock changed while posting; transaction rolled back');
          await appendStockMovementOnce(client,{organisationId:org(req),outletId:intent.outlet_id,productId:line.productId,movementType:'SALE',quantityUnits:line.quantity,referenceType:'BAR_TICKET',referenceId:ticketId,idempotencyKey:`offline-bar:${intent.source_event_id}:line:${lineIndex}`,notes:'P531 offline bar checkout',createdBy:req.auth!.userId});
        }
        const ticketLine = await client.query(`INSERT INTO bar_ticket_lines(ticket_id,product_id,line_type,quantity,volume_ml,unit_price,tax_amount,line_total,open_bottle_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`, [ticketId,line.productId,line.lineType,line.quantity,line.volumeMl??null,line.unitPrice,line.taxAmount,line.lineTotal,line.openBottleId??null]);
        await client.query('INSERT INTO bar_kot_lines(kot_order_id,ticket_line_id,product_id,quantity) VALUES($1,$2,$3,$4)', [kot.rows[0].id,ticketLine.rows[0].id,line.productId,line.quantity]);
      }
      for (const payment of payload.payments) await client.query(`INSERT INTO bar_payments(organisation_id,ticket_id,method,amount,reference,settlement_status) VALUES($1,$2,$3,$4,$5,'RECORDED_OFFLINE')`, [org(req),ticketId,payment.method,payment.amountMinor/100,payment.reference??intent.source_event_id]);
      await client.query(`INSERT INTO offline_posting_executions(organisation_id,outlet_id,posting_intent_id,event_row_id,bar_ticket_id,outcome,payload_hash) VALUES($1,$2,$3,$4,$5,'POSTED',$6)`, [org(req),intent.outlet_id,intent.id,intent.event_row_id,ticketId,intent.payload_hash]);
      await client.query("UPDATE offline_posting_intents SET status='POSTED' WHERE id=$1", [intent.id]);
      await client.query("UPDATE offline_sync_events SET status='POSTED' WHERE id=$1", [intent.event_row_id]);
      await client.query(`INSERT INTO offline_sync_audit(organisation_id,batch_id,actor_user_id,action,details) VALUES($1,$2,$3,'LEDGER_POSTED',$4::jsonb)`, [org(req),intent.batch_id,req.auth!.userId,JSON.stringify({intentId:intent.id,barTicketId:ticketId,totalMinor:payload.totalMinor,pegLines:resolved.filter(x=>x.lineType==='PEG').length,stockLines:resolved.filter(x=>x.lineType!=='PEG').length,journal:'DEFERRED_TO_P536'})]);
      await client.query('COMMIT');
      return res.status(201).json({ data: { ...ticket.rows[0], id: ticketId, lines: resolved.length }, inventory: 'BAR_MEASURE_AND_STOCK_POSTED', paymentSettlement: 'PENDING_RECONCILIATION', journals: 'DEFERRED_TO_P536', idempotentReplay: false });
    }

    const lineRows: Array<{ productId: string; quantity: number; unitPrice: number; lineTotal: number; tax: number }> = [];
    let subtotal = 0; let taxTotal = 0;
    for (const line of payload.items) {
      if (!uuid.safeParse(line.productId).success || !Number.isSafeInteger(line.quantity) || line.quantity <= 0 || !Number.isSafeInteger(line.unitPriceMinor) || line.unitPriceMinor <= 0) return await block('INVALID_SALE_LINE', 'Each line requires a valid product, positive integer quantity and unit price in paise.');
      const price = await client.query(`SELECT p.unit_price,p.tax_rate FROM outlet_product_prices p JOIN products pr ON pr.id=p.product_id AND pr.organisation_id=p.organisation_id
        WHERE p.organisation_id=$1 AND p.outlet_id=$2 AND p.product_id=$3 AND p.channel='RETAIL'
        AND p.effective_from<=NOW() AND (p.effective_until IS NULL OR p.effective_until>NOW()) AND pr.status='ACTIVE'
        ORDER BY p.effective_from DESC LIMIT 1`, [org(req), intent.outlet_id, line.productId]);
      if (!price.rowCount || Math.round(Number(price.rows[0].unit_price) * 100) !== line.unitPriceMinor) return await block('PRICE_CHANGED', 'One or more sale prices no longer match the current outlet price book.');
      const stock = await client.query('SELECT quantity_units FROM stock_balances WHERE organisation_id=$1 AND outlet_id=$2 AND product_id=$3 FOR UPDATE', [org(req), intent.outlet_id, line.productId]);
      if (!stock.rowCount || Number(stock.rows[0].quantity_units) < line.quantity) return await block('INSUFFICIENT_STOCK', 'Current stock is insufficient at posting time.');
      const lineBase = line.unitPriceMinor * line.quantity;
      const tax = Math.round(lineBase * Number(price.rows[0].tax_rate ?? 0) / (100 + Number(price.rows[0].tax_rate ?? 0)));
      subtotal += lineBase - tax; taxTotal += tax;
      lineRows.push({ productId: line.productId, quantity: line.quantity, unitPrice: line.unitPriceMinor / 100, lineTotal: lineBase / 100, tax: tax / 100 });
    }
    const total = payload.totalMinor / 100;
    if (Math.round((subtotal + taxTotal) * 100) !== payload.totalMinor) return await block('TOTAL_MISMATCH', 'Server-derived line totals do not equal the submitted sale total.');
    const sale = await client.query(`INSERT INTO retail_sales(organisation_id,outlet_id,receipt_number,subtotal,tax_total,discount_total,grand_total,payment_status,idempotency_key,sold_at)
      VALUES($1,$2,$3,$4,$5,0,$6,'PENDING',$7,COALESCE($8::timestamptz,NOW()))
      ON CONFLICT(outlet_id,idempotency_key) DO NOTHING RETURNING id,receipt_number,grand_total`,
      [org(req), intent.outlet_id, `OFF-${intent.source_event_id}`.slice(0,48), subtotal/100, taxTotal/100, total, intent.source_event_id, payload.occurredAt]);
    if (!sale.rowCount) {
      const existing = await client.query('SELECT id,receipt_number,grand_total FROM retail_sales WHERE outlet_id=$1 AND idempotency_key=$2', [intent.outlet_id, intent.source_event_id]);
      if (!existing.rowCount) return await block('IDEMPOTENCY_CONFLICT', 'An existing sale uses the idempotency key but cannot be resolved.');
      await client.query(`INSERT INTO offline_posting_executions(organisation_id,outlet_id,posting_intent_id,event_row_id,sale_id,outcome,payload_hash)
        VALUES($1,$2,$3,$4,$5,'POSTED',$6)`, [org(req), intent.outlet_id, intent.id, intent.event_row_id, existing.rows[0].id, intent.payload_hash]);
      await client.query("UPDATE offline_posting_intents SET status='POSTED' WHERE id=$1", [intent.id]);
      await client.query('COMMIT'); return res.json({ data: existing.rows[0], idempotentReplay: true, ledgerPosting: 'SALES_AND_STOCK_POSTED; JOURNAL_DEFERRED_TO_P536' });
    }
    const saleId = sale.rows[0].id;
    await client.query('UPDATE retail_sales SET excise_decision_id=$1 WHERE id=$2', [compliance.decisionId, saleId]);
    for (let index=0; index<lineRows.length; index++) {
      const line = lineRows[index]; const source = payload.items[index];
      const saleLine=await client.query(`INSERT INTO retail_sale_lines(sale_id,product_id,quantity_units,unit_price,tax_amount,line_total) VALUES($1,$2,$3,$4,$5,$6) RETURNING id`, [saleId,line.productId,line.quantity,line.unitPrice,line.tax,line.lineTotal]);
      const updated = await client.query(`UPDATE stock_balances SET quantity_units=quantity_units-$1,updated_at=NOW() WHERE organisation_id=$2 AND outlet_id=$3 AND product_id=$4 AND quantity_units >= $1 RETURNING quantity_units`, [line.quantity,org(req),intent.outlet_id,line.productId]);
      if (!updated.rowCount) throw new Error('Stock changed while posting; transaction rolled back');
      const movement=await appendStockMovementOnce(client,{organisationId:org(req),outletId:intent.outlet_id,productId:line.productId,movementType:'SALE',quantityUnits:line.quantity,referenceType:'RETAIL_SALE',referenceId:saleId,idempotencyKey:`offline-retail:${intent.source_event_id}:line:${index}`,notes:`Offline event ${intent.source_event_id}`,createdBy:req.auth!.userId});
      await client.query('UPDATE retail_sale_lines SET stock_movement_id=$1 WHERE id=$2',[movement.id,saleLine.rows[0].id]);
      await consumeInventoryBatchFefo(client,{organisationId:org(req),outletId:intent.outlet_id,productId:line.productId,stockMovementId:movement.id,quantityUnits:line.quantity});
    }
    for (const payment of payload.payments) await client.query(`INSERT INTO sale_payments(organisation_id,sale_id,method,amount,reference,status) VALUES($1,$2,$3,$4,$5,'RECORDED_OFFLINE')`, [org(req),saleId,payment.method,payment.amountMinor/100,payment.reference ?? intent.source_event_id]);
    await client.query(`INSERT INTO offline_posting_executions(organisation_id,outlet_id,posting_intent_id,event_row_id,sale_id,outcome,payload_hash)
      VALUES($1,$2,$3,$4,$5,'POSTED',$6)`, [org(req),intent.outlet_id,intent.id,intent.event_row_id,saleId,intent.payload_hash]);
    await client.query("UPDATE offline_posting_intents SET status='POSTED' WHERE id=$1", [intent.id]);
    await client.query("UPDATE offline_sync_events SET status='POSTED' WHERE id=$1", [intent.event_row_id]);
    await client.query(`INSERT INTO offline_sync_audit(organisation_id,batch_id,actor_user_id,action,details) VALUES($1,$2,$3,'LEDGER_POSTED',$4::jsonb)`, [org(req),intent.batch_id,req.auth!.userId,JSON.stringify({intentId:intent.id,saleId,totalMinor:payload.totalMinor,stockLines:lineRows.length,journal:'DEFERRED_TO_P536'})]);
    await client.query('COMMIT');
    res.status(201).json({ data: { ...sale.rows[0], id: saleId, stockLines: lineRows.length }, ledgerPosting: 'SALES_AND_STOCK_POSTED; JOURNAL_DEFERRED_TO_P536', idempotentReplay: false });
  } catch (error:any) { await client.query('ROLLBACK');if(typeof error?.code==='string'&&error.code.startsWith('INVENTORY_BATCH_'))return fail(res,error.code,error.message,409);throw error; }
  finally { client.release(); }
});

offlineLedgerPostingRouter.get('/offline/posting-executions', requirePermission('offline:ledger-read'), async (req: any, res: any) => {
  const result = await pool.query(`SELECT id,posting_intent_id,event_row_id,sale_id,bar_ticket_id,outcome,reason_code,payload_hash,executed_at FROM offline_posting_executions WHERE organisation_id=$1 ORDER BY executed_at DESC LIMIT 250`, [org(req)]);
  res.json({ data: result.rows });
});
