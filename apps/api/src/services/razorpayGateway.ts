import { createHmac, timingSafeEqual } from 'node:crypto';

const API_BASE = 'https://api.razorpay.com/v1';

export class RazorpayGatewayError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number | null = null
  ) {
    super(message);
    this.name = 'RazorpayGatewayError';
  }
}

export type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  status: string;
};

export type RazorpayPayment = {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  method: string;
  captured: boolean;
};

export function getRazorpayCredentials(environment = process.env): { keyId: string; keySecret: string } {
  const keyId = environment.RAZORPAY_KEY_ID?.trim() ?? '';
  const keySecret = environment.RAZORPAY_KEY_SECRET?.trim() ?? '';
  if (!keyId || !keySecret) throw new RazorpayGatewayError('RAZORPAY_CONFIGURATION_MISSING');

  const liveMode = keyId.startsWith('rzp_live_');
  if (!liveMode && !keyId.startsWith('rzp_test_')) {
    throw new RazorpayGatewayError('RAZORPAY_KEY_ID_INVALID');
  }
  if (liveMode && (environment.PAYMENT_LIVE_MODE !== 'true' || environment.NODE_ENV !== 'production')) {
    throw new RazorpayGatewayError('RAZORPAY_LIVE_MODE_DISABLED');
  }
  return { keyId, keySecret };
}

export function verifyRazorpayCheckoutSignature(orderId: string, paymentId: string, signature: string, secret: string): boolean {
  if (!orderId || !paymentId || !/^[a-f0-9]{64}$/i.test(signature) || !secret) return false;
  const expected = createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest();
  const supplied = Buffer.from(signature, 'hex');
  return supplied.length === expected.length && timingSafeEqual(expected, supplied);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { keyId, keySecret } = getRazorpayCredentials();
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
        'Content-Type': 'application/json',
        ...init.headers
      },
      signal: AbortSignal.timeout(15_000)
    });
  } catch {
    throw new RazorpayGatewayError('RAZORPAY_REQUEST_OUTCOME_UNKNOWN');
  }
  if (!response.ok) throw new RazorpayGatewayError('RAZORPAY_REQUEST_REJECTED', response.status);
  return response.json() as Promise<T>;
}

export function createRazorpayOrder(input: { amountPaise: number; receipt: string; ticketId: string; localOrderId: string }): Promise<RazorpayOrder> {
  return request<RazorpayOrder>('/orders', {
    method: 'POST',
    body: JSON.stringify({
      amount: input.amountPaise,
      currency: 'INR',
      receipt: input.receipt,
      notes: { ticket_id: input.ticketId, local_order_id: input.localOrderId }
    })
  });
}

export function fetchRazorpayPayment(paymentId: string): Promise<RazorpayPayment> {
  if (!/^pay_[A-Za-z0-9]+$/.test(paymentId)) throw new RazorpayGatewayError('RAZORPAY_PAYMENT_ID_INVALID', 400);
  return request<RazorpayPayment>(`/payments/${encodeURIComponent(paymentId)}`, { method: 'GET' });
}
