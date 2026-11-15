import { createHash, randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireOrgScope } from '../middleware/requireOrgScope.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { checkOutletOperationalAccess } from '../services/outletOperationalAccess.js';
import { calculateBarSettlement, createBarSettlementFingerprint } from '../services/barTabSettlement.js';
import {
  createRazorpayOrder,
  fetchRazorpayPayment,
  getRazorpayCredentials,
  RazorpayGatewayError,
  verifyRazorpayCheckoutSignature
} from '../services/razorpayGateway.js';

export const razorpayTabPaymentsRouter = Router();
razorpayTabPaymentsRouter.use(authenticate, requireOrgScope);

const uuid = z.string().uuid();
const createOrderSchema = z.object({ idempotencyKey: uuid });
const verifyPaymentSchema = z.object({
  localOrderId: uuid,
  razorpayOrderId: z.string().regex(/^order_[A-Za-z0-9]+$/),
  razorpayPaymentId: z.string().regex(/^pay_[A-Za-z0-9]+$/),
  razorpaySignature: z.string().regex(/^[a-f0-9]{64}$/i)
});

function amountToPaise(amount: number): number {
  const paise = Math.round((amount + Number.EPSILON) * 100);
  if (!Number.isSafeInteger(paise) || paise <= 0) throw new Error('INVALID_TICKET_BALANCE');
  return paise;
}

function clientOrder(order: { id: string; provider_order_id: string; amount_paise: string | number }, keyId: string) {
  return {
    localOrderId: order.id,
    orderId: order.provider_order_id,
    amount: Number(order.amount_paise),
    currency: 'INR',
    keyId
  };
}

razorpayTabPaymentsRouter.post('/bar/tickets/:ticketId/razorpay-order', requirePermission('bar:sell'), async (req, res) => {
  if (!uuid.safeParse(req.params.ticketId).success) return res.status(400).json({ error: { code: 'INVALID_TICKET_ID' } });
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() } });
  let credentials: ReturnType<typeof getRazorpayCredentials>;
  try {
    credentials = getRazorpayCredentials();
  } catch (error) {
    const code = error instanceof RazorpayGatewayError ? error.message : 'RAZORPAY_CONFIGURATION_INVALID';
    return res.status(503).json({ error: { code } });
  }

  const organisationId = req.auth!.organisationId!;
  const fingerprint = createHash('sha256').update(`${req.params.ticketId}|INR|FULL_BALANCE`).digest('hex');
  const client = await pool.connect();
  let order: {
    id: string;
    organisation_id: string;
    outlet_id: string;
    ticket_id: string;
    amount_paise: string | number;
    provider_order_id: string | null;
    request_fingerprint: string;
    status: string;
  };
  try {
    await client.query('BEGIN');
    const ticket = await client.query(
      `SELECT t.*,COALESCE((SELECT SUM(p.amount) FROM bar_payments p WHERE p.ticket_id=t.id),0) paid_total
         FROM bar_tickets t WHERE t.id=$1 AND t.organisation_id=$2 FOR UPDATE`,
      [req.params.ticketId, organisationId]
    );
    if (!ticket.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: { code: 'TICKET_NOT_FOUND' } });
    }
    const access = await checkOutletOperationalAccess(client, organisationId, ticket.rows[0].outlet_id, 'BAR_SERVICE', {
      userId: req.auth!.userId,
      roleCode: req.auth!.roleCode
    });
    if (!access.allowed) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: { code: access.code, message: access.message } });
    }
    if (!['SENT', 'PART_PAID'].includes(ticket.rows[0].status)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: { code: 'TICKET_NOT_OPEN_FOR_PAYMENT' } });
    }

    const previous = await client.query(
      `SELECT * FROM p597_razorpay_bar_tab_orders
        WHERE organisation_id=$1 AND ticket_id=$2 AND idempotency_key=$3 FOR UPDATE`,
      [organisationId, req.params.ticketId, parsed.data.idempotencyKey]
    );
    if (previous.rowCount) {
      order = previous.rows[0];
      if (order.request_fingerprint !== fingerprint) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: { code: 'IDEMPOTENCY_KEY_REUSED' } });
      }
      if (order.status === 'CREATED' && order.provider_order_id) {
        await client.query('COMMIT');
        return res.json({ data: clientOrder(order as typeof order & { provider_order_id: string }, credentials.keyId), idempotentReplay: true });
      }
      await client.query('ROLLBACK');
      return res.status(409).json({ error: { code: order.status === 'REVIEW_REQUIRED' ? 'PAYMENT_REQUIRES_REVIEW' : 'PAYMENT_ORDER_NOT_READY' } });
    }

    const active = await client.query(
      `SELECT * FROM p597_razorpay_bar_tab_orders
        WHERE organisation_id=$1 AND ticket_id=$2 AND status IN ('CREATING','CREATED','REVIEW_REQUIRED')
        FOR UPDATE`,
      [organisationId, req.params.ticketId]
    );
    if (active.rowCount) {
      order = active.rows[0];
      if (order.status === 'CREATED' && order.provider_order_id) {
        await client.query('COMMIT');
        return res.json({ data: clientOrder(order as typeof order & { provider_order_id: string }, credentials.keyId), reusedActiveOrder: true });
      }
      await client.query('ROLLBACK');
      return res.status(409).json({ error: { code: order.status === 'REVIEW_REQUIRED' ? 'PAYMENT_REQUIRES_REVIEW' : 'PAYMENT_ORDER_NOT_READY' } });
    }

    const due = Number(ticket.rows[0].grand_total) - Number(ticket.rows[0].paid_total);
    let amountPaise: number;
    try {
      amountPaise = amountToPaise(due);
    } catch {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: { code: 'INVALID_TICKET_BALANCE' } });
    }
    const inserted = await client.query(
      `INSERT INTO p597_razorpay_bar_tab_orders
        (organisation_id,outlet_id,ticket_id,idempotency_key,request_fingerprint,amount_paise,created_by)
       VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [organisationId, ticket.rows[0].outlet_id, req.params.ticketId, parsed.data.idempotencyKey, fingerprint, amountPaise, req.auth!.userId]
    );
    order = inserted.rows[0];
    await client.query('COMMIT');
  } catch (error: any) {
    await client.query('ROLLBACK');
    if (error?.code === '23505') return res.status(409).json({ error: { code: 'PAYMENT_ORDER_ALREADY_ACTIVE' } });
    throw error;
  } finally {
    client.release();
  }

  try {
    const providerOrder = await createRazorpayOrder({
      amountPaise: Number(order.amount_paise),
      receipt: `bar-${order.id.replaceAll('-', '')}`,
      ticketId: order.ticket_id,
      localOrderId: order.id
    });
    if (providerOrder.amount !== Number(order.amount_paise) || providerOrder.currency !== 'INR' || providerOrder.status !== 'created') {
      const reviewClient = await pool.connect();
      try {
        await reviewClient.query('BEGIN');
        await reviewClient.query(
          `UPDATE p597_razorpay_bar_tab_orders SET status='REVIEW_REQUIRED',provider_order_id=$1,updated_at=NOW() WHERE id=$2`,
          [providerOrder.id, order.id]
        );
        await reviewClient.query(
          `INSERT INTO p535_payment_exceptions
            (organisation_id,outlet_id,exception_type,source_type,source_id,severity,reason,created_by)
           VALUES($1,$2,'RAZORPAY_ORDER_DETAILS_MISMATCH','BAR_TICKET',$3,'CRITICAL',$4,$5)`,
          [organisationId, order.outlet_id, order.ticket_id, `Razorpay order ${providerOrder.id} does not match local order ${order.id}.`, req.auth!.userId]
        );
        await reviewClient.query('COMMIT');
      } catch (reviewError) {
        await reviewClient.query('ROLLBACK');
        throw reviewError;
      } finally {
        reviewClient.release();
      }
      return res.status(502).json({ error: { code: 'PAYMENT_ORDER_REQUIRES_REVIEW' } });
    }
    const saved = await pool.query(
      `UPDATE p597_razorpay_bar_tab_orders SET status='CREATED',provider_order_id=$1,updated_at=NOW()
        WHERE id=$2 AND status='CREATING' RETURNING *`,
      [providerOrder.id, order.id]
    );
    if (!saved.rowCount) return res.status(409).json({ error: { code: 'PAYMENT_ORDER_STATE_CHANGED' } });
    return res.status(201).json({ data: clientOrder(saved.rows[0], credentials.keyId) });
  } catch (error) {
    const isDefinitiveRejection = error instanceof RazorpayGatewayError && error.httpStatus !== null && error.httpStatus < 500;
    const failureClient = await pool.connect();
    try {
      await failureClient.query('BEGIN');
      await failureClient.query(
        `UPDATE p597_razorpay_bar_tab_orders SET status=$1,updated_at=NOW() WHERE id=$2 AND status='CREATING'`,
        [isDefinitiveRejection ? 'FAILED' : 'REVIEW_REQUIRED', order.id]
      );
      if (!isDefinitiveRejection) {
        await failureClient.query(
          `INSERT INTO p535_payment_exceptions
            (organisation_id,outlet_id,exception_type,source_type,source_id,severity,reason,created_by)
           VALUES($1,$2,'RAZORPAY_ORDER_CREATION_OUTCOME_UNKNOWN','BAR_TICKET',$3,'HIGH',$4,$5)`,
          [organisationId, order.outlet_id, order.ticket_id, `Razorpay order creation outcome is unknown for local order ${order.id}.`, req.auth!.userId]
        );
      }
      await failureClient.query('COMMIT');
    } catch (failureError) {
      await failureClient.query('ROLLBACK');
      throw failureError;
    } finally {
      failureClient.release();
    }
    return res.status(502).json({ error: { code: isDefinitiveRejection ? 'PAYMENT_PROVIDER_REJECTED_ORDER' : 'PAYMENT_ORDER_OUTCOME_UNKNOWN' } });
  }
});

razorpayTabPaymentsRouter.post('/bar/tickets/:ticketId/razorpay-verify', requirePermission('bar:sell'), async (req, res) => {
  if (!uuid.safeParse(req.params.ticketId).success) return res.status(400).json({ error: { code: 'INVALID_TICKET_ID' } });
  const parsed = verifyPaymentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() } });
  let credentials: ReturnType<typeof getRazorpayCredentials>;
  try {
    credentials = getRazorpayCredentials();
  } catch (error) {
    const code = error instanceof RazorpayGatewayError ? error.message : 'RAZORPAY_CONFIGURATION_INVALID';
    return res.status(503).json({ error: { code } });
  }
  const organisationId = req.auth!.organisationId!;
  let client: PoolClient | undefined;
  try {
    const found = await pool.query(
      `SELECT * FROM p597_razorpay_bar_tab_orders
        WHERE id=$1 AND ticket_id=$2 AND organisation_id=$3`,
      [parsed.data.localOrderId, req.params.ticketId, organisationId]
    );
    if (!found.rowCount) return res.status(404).json({ error: { code: 'PAYMENT_ORDER_NOT_FOUND' } });
    const intent = found.rows[0];
    if (intent.provider_order_id !== parsed.data.razorpayOrderId) {
      return res.status(409).json({ error: { code: 'PAYMENT_ORDER_MISMATCH' } });
    }
    if (!verifyRazorpayCheckoutSignature(
      parsed.data.razorpayOrderId, parsed.data.razorpayPaymentId, parsed.data.razorpaySignature, credentials.keySecret
    )) {
      return res.status(401).json({ error: { code: 'PAYMENT_SIGNATURE_INVALID' } });
    }
    if (intent.status === 'PAID') {
      if (intent.provider_payment_id !== parsed.data.razorpayPaymentId) {
        return res.status(409).json({ error: { code: 'PAYMENT_ORDER_ALREADY_USED' } });
      }
      return res.json({ data: { ticketId: intent.ticket_id, status: 'PAID' }, idempotentReplay: true });
    }
    if (intent.status !== 'CREATED') return res.status(409).json({ error: { code: 'PAYMENT_ORDER_NOT_READY' } });

    let payment;
    try {
      payment = await fetchRazorpayPayment(parsed.data.razorpayPaymentId);
    } catch {
      return res.status(502).json({ error: { code: 'PAYMENT_STATUS_UNAVAILABLE' } });
    }
    if (payment.order_id !== intent.provider_order_id
      || payment.amount !== Number(intent.amount_paise)
      || payment.currency !== 'INR') {
      if (payment.status === 'captured' && payment.captured) {
        const reviewClient = await pool.connect();
        try {
          await reviewClient.query('BEGIN');
          await reviewClient.query(
            `UPDATE p597_razorpay_bar_tab_orders
                SET status='REVIEW_REQUIRED',provider_payment_id=$1,provider_method=$2,updated_at=NOW()
              WHERE id=$3 AND status='CREATED'`,
            [payment.id, payment.method, intent.id]
          );
          await reviewClient.query(
            `INSERT INTO p535_payment_exceptions
              (organisation_id,outlet_id,exception_type,source_type,source_id,severity,reason,created_by)
             VALUES($1,$2,'RAZORPAY_PAYMENT_DETAILS_MISMATCH','BAR_TICKET',$3,'CRITICAL',$4,$5)`,
            [organisationId, intent.outlet_id, intent.ticket_id, `Captured Razorpay payment ${payment.id} does not match local order ${intent.id}.`, req.auth!.userId]
          );
          await reviewClient.query('COMMIT');
        } catch (error) {
          await reviewClient.query('ROLLBACK');
          throw error;
        } finally {
          reviewClient.release();
        }
        return res.status(409).json({ error: { code: 'PAYMENT_REQUIRES_MANUAL_REVIEW' } });
      }
      return res.status(409).json({ error: { code: 'PAYMENT_DETAILS_MISMATCH' } });
    }
    if (payment.status !== 'captured' || !payment.captured) {
      return res.status(409).json({ error: { code: 'PAYMENT_NOT_CAPTURED' } });
    }

    client = await pool.connect();
    await client.query('BEGIN');
    const lockedIntent = await client.query(
      `SELECT * FROM p597_razorpay_bar_tab_orders WHERE id=$1 AND organisation_id=$2 FOR UPDATE`,
      [intent.id, organisationId]
    );
    const ticket = await client.query(
      `SELECT * FROM bar_tickets WHERE id=$1 AND organisation_id=$2 FOR UPDATE`,
      [intent.ticket_id, organisationId]
    );
    if (!ticket.rowCount || !lockedIntent.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: { code: 'PAYMENT_SOURCE_NOT_FOUND' } });
    }
    const access = await checkOutletOperationalAccess(client, organisationId, ticket.rows[0].outlet_id, 'BAR_SERVICE', {
      userId: req.auth!.userId,
      roleCode: req.auth!.roleCode
    });
    if (!access.allowed) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: { code: access.code, message: access.message } });
    }
    if (lockedIntent.rows[0].status === 'PAID') {
      if (lockedIntent.rows[0].provider_payment_id !== payment.id) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: { code: 'PAYMENT_ORDER_ALREADY_USED' } });
      }
      await client.query('COMMIT');
      return res.json({ data: { ticketId: intent.ticket_id, status: ticket.rows[0].status }, idempotentReplay: true });
    }

    const paid = await client.query('SELECT COALESCE(SUM(amount),0) paid_total FROM bar_payments WHERE ticket_id=$1', [intent.ticket_id]);
    const due = Number(ticket.rows[0].grand_total) - Number(paid.rows[0].paid_total);
    const duePaise = Math.round((due + Number.EPSILON) * 100);
    if (!['SENT', 'PART_PAID'].includes(ticket.rows[0].status)
      || !Number.isSafeInteger(duePaise) || duePaise <= 0 || duePaise !== Number(intent.amount_paise)) {
      await client.query(
        `UPDATE p597_razorpay_bar_tab_orders SET status='REVIEW_REQUIRED',provider_payment_id=$1,provider_method=$2,updated_at=NOW() WHERE id=$3`,
        [payment.id, payment.method, intent.id]
      );
      await client.query(
        `INSERT INTO p535_payment_exceptions
          (organisation_id,outlet_id,exception_type,source_type,source_id,severity,reason,created_by)
         VALUES($1,$2,'RAZORPAY_PAYMENT_TICKET_BALANCE_MISMATCH','BAR_TICKET',$3,'HIGH',$4,$5)`,
        [organisationId, ticket.rows[0].outlet_id, intent.ticket_id, `Captured Razorpay payment ${payment.id} cannot be applied because the ticket balance changed.`, req.auth!.userId]
      );
      await client.query('COMMIT');
      return res.status(409).json({ error: { code: 'PAYMENT_REQUIRES_MANUAL_REVIEW' } });
    }

    const tenderMethod = payment.method === 'upi' ? 'UPI'
      : payment.method === 'card' ? 'CARD'
        : payment.method === 'wallet' ? 'WALLET' : 'OTHER';
    const amount = Number(intent.amount_paise) / 100;
    const payments = [{ method: tenderMethod, amount, reference: payment.id }];
    const settlement = calculateBarSettlement(Number(ticket.rows[0].grand_total), Number(paid.rows[0].paid_total), payments);
    const paymentRequestKey = `razorpay-${intent.id}`;
    const paymentFingerprint = createBarSettlementFingerprint(intent.ticket_id, payments);
    await client.query(
      `INSERT INTO bar_payment_requests(organisation_id,ticket_id,idempotency_key,request_fingerprint,created_by)
       VALUES($1,$2,$3,$4,$5)`,
      [organisationId, intent.ticket_id, paymentRequestKey, paymentFingerprint, req.auth!.userId]
    );
    await client.query(
      `INSERT INTO bar_payments(organisation_id,ticket_id,method,amount,reference,idempotency_key,request_fingerprint,settlement_status)
       VALUES($1,$2,$3,$4,$5,$6,$7,'PENDING')`,
      [organisationId, intent.ticket_id, tenderMethod, amount, payment.id, paymentRequestKey, paymentFingerprint]
    );
    await client.query(
      `INSERT INTO p535_tender_allocations
        (organisation_id,outlet_id,source_type,source_id,tender_method,amount,provider,provider_transaction_id,lifecycle_status,created_by)
       VALUES($1,$2,'BAR',$3,$4,$5,'razorpay',$6,'PENDING',$7)`,
      [organisationId, ticket.rows[0].outlet_id, intent.ticket_id, tenderMethod, amount, payment.id, req.auth!.userId]
    );
    await client.query(`UPDATE bar_tickets SET status=$1,closed_at=CASE WHEN $1='PAID' THEN NOW() ELSE NULL END WHERE id=$2`,
      [settlement.status, intent.ticket_id]);
    await client.query(
      `UPDATE p597_razorpay_bar_tab_orders SET status='PAID',provider_payment_id=$1,provider_method=$2,updated_at=NOW() WHERE id=$3`,
      [payment.id, payment.method, intent.id]
    );
    await client.query(
      `INSERT INTO audit_events(organisation_id,outlet_id,actor_user_id,event_type,entity_type,entity_id,metadata)
       VALUES($1,$2,$3,'BAR_TAB_RAZORPAY_PAYMENT_CAPTURED','BAR_TICKET',$4,$5)`,
      [organisationId, ticket.rows[0].outlet_id, req.auth!.userId, intent.ticket_id, {
        razorpayOrderId: intent.provider_order_id,
        razorpayPaymentId: payment.id,
        amount,
        tenderMethod,
        remainingDue: settlement.remainingDue,
        status: settlement.status
      }]
    );
    await client.query('COMMIT');
    return res.json({
      data: { ticketId: intent.ticket_id, status: settlement.status, paidTotal: settlement.paidTotal, remainingDue: settlement.remainingDue },
      idempotentReplay: false
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    throw error;
  } finally {
    client?.release();
  }
});
