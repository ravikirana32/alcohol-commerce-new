import { describe, expect, it } from 'vitest';
import { calculateBarTotals } from '../src/routes/barCheckout.js';

describe('calculateBarTotals', () => {
  it('calculates subtotal, tax and grand total from server-resolved prices', () => {
    expect(calculateBarTotals([
      { quantity: 2, unitPrice: 100, taxRate: 10 },
      { quantity: 1, unitPrice: 50, taxRate: 5 }
    ])).toEqual({ subtotal: 250, taxTotal: 22.5, grandTotal: 272.5 });
  });

  it('rounds each line tax to two decimal places', () => {
    expect(calculateBarTotals([
      { quantity: 1, unitPrice: 10.05, taxRate: 5 }
    ])).toEqual({ subtotal: 10.05, taxTotal: 0.5, grandTotal: 10.55 });
  });
});
