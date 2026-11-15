import { describe, expect, it } from 'vitest';
import { calculateBarSettlement, createBarSettlementFingerprint } from '../src/services/barTabSettlement.js';

const ticketId = '11111111-1111-4111-8111-111111111111';

describe('bar tab settlement', () => {
  it('records a partial payment and returns the outstanding balance', () => {
    expect(calculateBarSettlement(125.5, 0, [{ method: 'CASH', amount: 40 }])).toEqual({
      paidTotal: 40,
      remainingDue: 85.5,
      status: 'PART_PAID'
    });
  });

  it('settles mixed tenders together to exactly close a ticket', () => {
    expect(calculateBarSettlement(100, 25, [
      { method: 'CASH', amount: 30 },
      { method: 'CARD', amount: 45, reference: ' terminal-1 ' }
    ])).toEqual({ paidTotal: 100, remainingDue: 0, status: 'PAID' });
  });

  it('rejects a payment that exceeds the remaining amount', () => {
    expect(() => calculateBarSettlement(100, 60, [{ method: 'UPI', amount: 40.01 }]))
      .toThrow('PAYMENT_EXCEEDS_BALANCE');
  });

  it('rejects invalid existing balances and empty settlement batches', () => {
    expect(() => calculateBarSettlement(100, 101, [{ method: 'CASH', amount: 1 }]))
      .toThrow('INVALID_TICKET_BALANCE');
    expect(() => calculateBarSettlement(100, 0, [])).toThrow('PAYMENT_EXCEEDS_BALANCE');
  });

  it('rounds accumulated payment math to cents', () => {
    expect(calculateBarSettlement(10.01, 3.33, [
      { method: 'CASH', amount: 3.34 },
      { method: 'UPI', amount: 3.34 }
    ])).toEqual({ paidTotal: 10.01, remainingDue: 0, status: 'PAID' });
  });

  it('fingerprints split tenders independent of order and whitespace in references', () => {
    const payments = [
      { method: 'CASH', amount: 25 },
      { method: 'CARD', amount: 75, reference: ' terminal-1 ' }
    ];
    expect(createBarSettlementFingerprint(ticketId, payments)).toBe(createBarSettlementFingerprint(
      ticketId.toUpperCase(),
      [{ ...payments[1], reference: 'terminal-1' }, payments[0]]
    ));
    expect(createBarSettlementFingerprint(ticketId, payments)).not.toBe(
      createBarSettlementFingerprint(ticketId, [{ ...payments[0], amount: 26 }, payments[1]])
    );
  });
});
