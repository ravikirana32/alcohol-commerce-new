import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createRazorpayOrder,
  fetchRazorpayPayment,
  getRazorpayCredentials,
  RazorpayGatewayError,
  verifyRazorpayCheckoutSignature
} from './razorpayGateway.js';

const originalEnvironment = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnvironment };
  vi.unstubAllGlobals();
});

describe('Razorpay gateway', () => {
  it('requires test keys by default and refuses live keys outside an explicitly enabled production environment', () => {
    expect(() => getRazorpayCredentials({})).toThrow('RAZORPAY_CONFIGURATION_MISSING');
    expect(() => getRazorpayCredentials({ RAZORPAY_KEY_ID: 'rzp_live_1', RAZORPAY_KEY_SECRET: 'secret' }))
      .toThrow('RAZORPAY_LIVE_MODE_DISABLED');
    expect(getRazorpayCredentials({ RAZORPAY_KEY_ID: 'rzp_test_1', RAZORPAY_KEY_SECRET: 'secret' }).keyId)
      .toBe('rzp_test_1');
  });

  it('verifies checkout signatures and rejects malformed or tampered signatures', () => {
    const signature = createHmac('sha256', 'secret').update('order_123|pay_456').digest('hex');
    expect(verifyRazorpayCheckoutSignature('order_123', 'pay_456', signature, 'secret')).toBe(true);
    expect(verifyRazorpayCheckoutSignature('order_123', 'pay_789', signature, 'secret')).toBe(false);
    expect(verifyRazorpayCheckoutSignature('order_123', 'pay_456', 'not-a-signature', 'secret')).toBe(false);
  });

  it('creates server-side orders in paise with INR and Basic authentication', async () => {
    process.env.RAZORPAY_KEY_ID = 'rzp_test_key';
    process.env.RAZORPAY_KEY_SECRET = 'test-secret';
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 'order_123', amount: 12550, currency: 'INR', status: 'created'
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetch);

    await expect(createRazorpayOrder({
      amountPaise: 12550, receipt: 'bar-123', ticketId: 'ticket-1', localOrderId: 'local-1'
    })).resolves.toMatchObject({ id: 'order_123', amount: 12550 });
    const [url, options] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.razorpay.com/v1/orders');
    expect(options.method).toBe('POST');
    expect(new Headers(options.headers).get('authorization')).toBe(`Basic ${Buffer.from('rzp_test_key:test-secret').toString('base64')}`);
    expect(JSON.parse(String(options.body))).toMatchObject({ amount: 12550, currency: 'INR' });
  });

  it('fetches payment status server-side and rejects provider failures', async () => {
    process.env.RAZORPAY_KEY_ID = 'rzp_test_key';
    process.env.RAZORPAY_KEY_SECRET = 'test-secret';
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 'pay_123', order_id: 'order_123', amount: 12550, currency: 'INR',
        status: 'captured', method: 'upi', captured: true
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 503 }));
    vi.stubGlobal('fetch', fetch);

    await expect(fetchRazorpayPayment('pay_123')).resolves.toMatchObject({ status: 'captured' });
    await expect(fetchRazorpayPayment('pay_456')).rejects.toBeInstanceOf(RazorpayGatewayError);
  });
});
