import { createHash } from 'node:crypto';

export type BarTender = { method: string; amount: number; reference?: string };

export function createBarSettlementFingerprint(ticketId: string, payments: BarTender[]): string {
  const canonical = {
    ticketId: ticketId.toLowerCase(),
    payments: payments.map((payment) => ({
      method: payment.method,
      amountMinor: Math.round(payment.amount * 100),
      reference: payment.reference?.trim() ?? ''
    })).sort((a, b) => a.method.localeCompare(b.method)
      || a.amountMinor - b.amountMinor
      || a.reference.localeCompare(b.reference))
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

export function calculateBarSettlement(
  grandTotal: number,
  paidToDate: number,
  payments: BarTender[]
): { paidTotal: number; remainingDue: number; status: 'PART_PAID' | 'PAID' } {
  const cents = (amount: number) => Math.round((amount + Number.EPSILON) * 100);
  const grandTotalCents = cents(grandTotal);
  const alreadyPaidCents = cents(paidToDate);
  const newPaymentCents = payments.reduce((sum, payment) => sum + cents(payment.amount), 0);

  if (grandTotalCents <= 0 || alreadyPaidCents < 0 || alreadyPaidCents > grandTotalCents) {
    throw new Error('INVALID_TICKET_BALANCE');
  }
  if (newPaymentCents <= 0 || alreadyPaidCents + newPaymentCents > grandTotalCents) {
    throw new Error('PAYMENT_EXCEEDS_BALANCE');
  }

  const paidTotalCents = alreadyPaidCents + newPaymentCents;
  const remainingDueCents = grandTotalCents - paidTotalCents;
  return {
    paidTotal: paidTotalCents / 100,
    remainingDue: remainingDueCents / 100,
    status: remainingDueCents === 0 ? 'PAID' : 'PART_PAID'
  };
}
