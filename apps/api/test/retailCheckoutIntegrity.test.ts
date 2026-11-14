import { describe, expect, it } from 'vitest';
import {
  calculateRetailLineAmounts,
  calculateRetailPaymentTotal,
  createRetailCheckoutFingerprint
} from '../src/services/retailCheckoutIntegrity.js';

const request = {
  outletId: '11111111-1111-4111-8111-111111111111',
  receiptNumber: ' R-100 ',
  lines: [
    { productId: '22222222-2222-4222-8222-222222222222', quantity: 2 },
    { productId: '33333333-3333-4333-8333-333333333333', quantity: 0.5 }
  ],
  payments: [
    { method: 'CASH', amount: 100.25 },
    { method: 'UPI', amount: 50, reference: 'upi-ref' }
  ]
};

describe('retail checkout integrity', () => {
  it('uses minor-unit arithmetic and rounds tax per line', () => {
    expect(calculateRetailLineAmounts(1.5, 10.05, 5)).toEqual({
      unitPrice: 10.05,
      base: 15.08,
      taxAmount: 0.75,
      lineTotal: 15.83
    });
  });

  it('sums payments in integer minor units', () => {
    expect(calculateRetailPaymentTotal([{ amount: 10.1 }, { amount: 0.2 }])).toBe(1030);
  });

  it('produces a stable fingerprint independent of line/payment ordering', () => {
    const reordered = {
      ...request,
      lines: [...request.lines].reverse(),
      payments: [...request.payments].reverse()
    };
    expect(createRetailCheckoutFingerprint(request)).toBe(createRetailCheckoutFingerprint(reordered));
  });

  it('changes the fingerprint when the semantic checkout changes', () => {
    expect(createRetailCheckoutFingerprint(request)).not.toBe(createRetailCheckoutFingerprint({
      ...request,
      receiptNumber: 'R-101'
    }));
  });

  it('normalises receipt whitespace and UUID casing', () => {
    const normalised = {
      ...request,
      outletId: request.outletId.toUpperCase(),
      receiptNumber: 'R-100'
    };
    expect(createRetailCheckoutFingerprint(request)).toBe(createRetailCheckoutFingerprint(normalised));
  });

  it('rejects quantities with more than three decimal places', () => {
    expect(() => calculateRetailLineAmounts(0.0001, 10, 0)).toThrow(/three decimal places/);
  });
});
