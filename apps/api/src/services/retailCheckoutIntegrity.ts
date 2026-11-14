import { createHash } from 'node:crypto';

export type RetailCheckoutFingerprintInput = {
  outletId: string;
  receiptNumber: string;
  lines: Array<{ productId: string; quantity: number }>;
  payments: Array<{ method: string; amount: number; reference?: string }>;
};

/** Canonicalise request semantics so an idempotency key cannot silently replay a different sale. */
export function createRetailCheckoutFingerprint(input: RetailCheckoutFingerprintInput): string {
  const canonical = {
    outletId: input.outletId.toLowerCase(),
    receiptNumber: input.receiptNumber.trim(),
    lines: input.lines
      .map((line) => ({ productId: line.productId.toLowerCase(), quantityMilli: Math.round(line.quantity * 1000) }))
      .sort((a, b) => a.productId.localeCompare(b.productId) || a.quantityMilli - b.quantityMilli),
    payments: input.payments
      .map((payment) => ({
        method: payment.method,
        amountMinor: Math.round(payment.amount * 100),
        reference: payment.reference?.trim() ?? ''
      }))
      .sort((a, b) => a.method.localeCompare(b.method) || a.amountMinor - b.amountMinor || a.reference.localeCompare(b.reference))
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

export function toMinorUnits(value: number): number {
  if (!Number.isFinite(value) || value < 0) throw new Error('Money value must be a finite non-negative number');
  return Math.round((value + Number.EPSILON) * 100);
}

export function calculateRetailLineAmounts(quantity: number, unitPrice: number, taxRate: number) {
  if (!Number.isFinite(quantity) || quantity <= 0 || Math.abs(Math.round(quantity * 1000) - quantity * 1000) > 1e-7) {
    throw new Error('Quantity must be positive and have at most three decimal places');
  }
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) throw new Error('Tax rate must be between 0 and 100');
  const unitPriceMinor = toMinorUnits(unitPrice);
  const quantityMilli = Math.round(quantity * 1000);
  const baseMinor = Math.round((unitPriceMinor * quantityMilli) / 1000);
  const taxMinor = Math.round((baseMinor * taxRate) / 100);
  return {
    unitPrice: unitPriceMinor / 100,
    base: baseMinor / 100,
    taxAmount: taxMinor / 100,
    lineTotal: (baseMinor + taxMinor) / 100
  };
}

export function calculateRetailPaymentTotal(payments: Array<{ amount: number }>): number {
  return payments.reduce((total, payment) => total + toMinorUnits(payment.amount), 0);
}
