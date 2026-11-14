import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';

export type StockMovementInput = {
  organisationId: string;
  outletId: string;
  productId: string;
  movementType: 'RECEIPT' | 'SALE' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'WASTAGE' | 'ADJUSTMENT' | 'RETURN' | 'SUPPLIER_RETURN';
  quantityUnits: number;
  adjustmentDirection?: 'INCREASE' | 'DECREASE' | null;
  referenceType?: string | null;
  referenceId?: string | null;
  idempotencyKey: string;
  notes?: string | null;
  createdBy?: string | null;
};

export type StockMovementResult = { id: string; created: boolean };

export function stockMovementFingerprint(input: StockMovementInput): string {
  // Canonical, explicit field order prevents object-key ordering from changing the digest.
  const canonical = JSON.stringify([
    input.organisationId, input.outletId, input.productId, input.movementType,
    Number(input.quantityUnits.toFixed(3)), input.adjustmentDirection ?? null, input.referenceType ?? null,
    input.referenceId ?? null, input.notes ?? null
  ]);
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Append exactly one movement per source event line.
 * Call inside the same transaction as the source document and stock balance mutation.
 * This helper intentionally does not mutate stock_balances.
 */
export async function appendStockMovementOnce(
  client: PoolClient,
  input: StockMovementInput
): Promise<StockMovementResult> {
  const key = input.idempotencyKey.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{15,159}$/.test(key)) {
    throw new Error('Invalid stock movement idempotency key');
  }
  if (!Number.isFinite(input.quantityUnits) || input.quantityUnits <= 0) {
    throw new Error('Stock movement quantity must be positive');
  }
  if (input.movementType === 'ADJUSTMENT' && !input.adjustmentDirection) {
    throw new Error('Stock adjustment direction is required');
  }
  const fingerprint = stockMovementFingerprint(input);
  const inserted = await client.query(
    `INSERT INTO stock_movements
      (organisation_id,outlet_id,product_id,movement_type,quantity_units,
       reference_type,reference_id,notes,created_by,idempotency_key,request_fingerprint,adjustment_direction)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (organisation_id,outlet_id,idempotency_key)
       WHERE idempotency_key IS NOT NULL DO NOTHING
     RETURNING id`,
    [input.organisationId,input.outletId,input.productId,input.movementType,
     input.quantityUnits,input.referenceType ?? null,input.referenceId ?? null,
     input.notes ?? null,input.createdBy ?? null,key,fingerprint,input.adjustmentDirection ?? null]
  );
  if (inserted.rowCount) return { id: inserted.rows[0].id, created: true };

  const existing = await client.query(
    `SELECT id,request_fingerprint FROM stock_movements
     WHERE organisation_id=$1 AND outlet_id=$2 AND idempotency_key=$3`,
    [input.organisationId,input.outletId,key]
  );
  if (!existing.rowCount || existing.rows[0].request_fingerprint !== fingerprint) {
    throw new Error('STOCK_MOVEMENT_IDEMPOTENCY_CONFLICT');
  }
  return { id: existing.rows[0].id, created: false };
}
