import { describe, expect, it, vi } from 'vitest';
import { appendStockMovementOnce, stockMovementFingerprint } from './stockMovementIdempotency.js';

const input = {
  organisationId: 'org-1', outletId: 'outlet-1', productId: 'product-1',
  movementType: 'RECEIPT' as const, quantityUnits: 5,
  referenceType: 'GOODS_RECEIPT', referenceId: 'receipt-1',
  idempotencyKey: 'goods-receipt:receipt-1:line-1'
};

describe('P566 stock movement idempotency', () => {
  it('fingerprints stable business fields', () => {
    expect(stockMovementFingerprint(input)).toBe(stockMovementFingerprint({ ...input }));
  });
  it('inserts once and returns created=true', async () => {
    const client: any = { query: vi.fn().mockResolvedValue({ rowCount: 1, rows: [{ id: 'movement-1' }] }) };
    await expect(appendStockMovementOnce(client, input)).resolves.toEqual({ id: 'movement-1', created: true });
    expect(client.query.mock.calls[0][0]).toContain('ON CONFLICT');
  });
  it('returns existing row for same key and same payload', async () => {
    const client: any = { query: vi.fn()
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'movement-1', request_fingerprint: stockMovementFingerprint(input) }] }) };
    await expect(appendStockMovementOnce(client, input)).resolves.toEqual({ id: 'movement-1', created: false });
  });
  it('rejects same key with different payload', async () => {
    const client: any = { query: vi.fn()
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'movement-1', request_fingerprint: '0'.repeat(64) }] }) };
    await expect(appendStockMovementOnce(client, input)).rejects.toThrow('STOCK_MOVEMENT_IDEMPOTENCY_CONFLICT');
  });
  it('rejects malformed keys and non-positive quantities before SQL', async () => {
    const client: any = { query: vi.fn() };
    await expect(appendStockMovementOnce(client, { ...input, idempotencyKey: 'short' })).rejects.toThrow('Invalid stock movement idempotency key');
    await expect(appendStockMovementOnce(client, { ...input, quantityUnits: 0 })).rejects.toThrow('positive');
    expect(client.query).not.toHaveBeenCalled();
  });
});
