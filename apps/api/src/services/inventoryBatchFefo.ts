import type { PoolClient } from 'pg';

type BatchScope = { organisationId: string; outletId: string; productId: string };

export async function consumeInventoryBatchFefo(client: PoolClient, input: BatchScope & {
  stockMovementId: string;
  quantityUnits: number;
  allowExpired?: boolean;
}): Promise<{ tracked: boolean }> {
  if (!Number.isFinite(input.quantityUnits) || input.quantityUnits <= 0) {
    throw new Error('Invalid batch consumption quantity');
  }
  const history = await client.query(
    `SELECT 1 FROM inventory_batches
      WHERE organisation_id=$1 AND outlet_id=$2 AND product_id=$3 LIMIT 1`,
    [input.organisationId,input.outletId,input.productId]
  );
  if (!history.rowCount) return { tracked: false };

  const batches = await client.query(
    `SELECT id,remaining_units FROM inventory_batches
      WHERE organisation_id=$1 AND outlet_id=$2 AND product_id=$3
        AND remaining_units>0 AND ($4::boolean OR expiry_date IS NULL OR expiry_date>=CURRENT_DATE)
      ORDER BY expiry_date NULLS LAST,received_at,id FOR UPDATE`,
    [input.organisationId,input.outletId,input.productId,input.allowExpired??false]
  );
  const available = batches.rows.reduce((sum: number, batch: any) => sum + Number(batch.remaining_units), 0);
  if (available + 0.0005 < input.quantityUnits) {
    throw Object.assign(new Error('Insufficient non-expired inventory batch quantity'), { code: 'INVENTORY_BATCH_INSUFFICIENT' });
  }

  let remaining = input.quantityUnits;
  for (const batch of batches.rows) {
    if (remaining <= 0.0005) break;
    const take = Math.min(remaining,Number(batch.remaining_units));
    const updated = await client.query(
      `UPDATE inventory_batches SET remaining_units=remaining_units-$1
        WHERE id=$2 AND organisation_id=$3 AND outlet_id=$4 AND product_id=$5 AND remaining_units >= $1
        RETURNING id`,
      [take,batch.id,input.organisationId,input.outletId,input.productId]
    );
    if (!updated.rowCount) throw Object.assign(new Error('Inventory batch changed during FEFO allocation'), { code: 'INVENTORY_BATCH_RACE' });
    await client.query(
      `INSERT INTO inventory_batch_movements(
         organisation_id,outlet_id,product_id,batch_id,stock_movement_id,movement_type,direction,quantity_units
       ) VALUES($1,$2,$3,$4,$5,'CONSUME','DECREASE',$6)`,
      [input.organisationId,input.outletId,input.productId,batch.id,input.stockMovementId,take]
    );
    remaining -= take;
  }
  if (remaining > 0.0005) throw Object.assign(new Error('Inventory batch allocation did not reconcile'), { code: 'INVENTORY_BATCH_ALLOCATION_MISMATCH' });
  return { tracked: true };
}

export async function restoreInventoryBatchFefo(client: PoolClient, input: BatchScope & {
  sourceMovementIds: string[];
  returnMovementId: string;
  quantityUnits: number;
}): Promise<{ tracked: boolean }> {
  if (!Number.isFinite(input.quantityUnits) || input.quantityUnits <= 0) {
    throw new Error('Invalid batch restoration input');
  }
  if (!input.sourceMovementIds.length) {
    const history=await client.query(
      'SELECT 1 FROM inventory_batches WHERE organisation_id=$1 AND outlet_id=$2 AND product_id=$3 LIMIT 1',
      [input.organisationId,input.outletId,input.productId]
    );
    if(history.rowCount)throw Object.assign(new Error('Cannot return stock into tracked batches without original batch-consumption evidence'),{code:'INVENTORY_BATCH_RETURN_EVIDENCE_MISSING'});
    return {tracked:false};
  }
  const consumptions = await client.query(
    `SELECT c.id,c.batch_id,c.stock_movement_id,c.quantity_units,
            (b.expiry_date IS NOT NULL AND b.expiry_date<CURRENT_DATE) AS expired
       FROM inventory_batch_movements c
       JOIN inventory_batches b ON b.id=c.batch_id AND b.organisation_id=c.organisation_id
        AND b.outlet_id=c.outlet_id AND b.product_id=c.product_id
      WHERE c.organisation_id=$1 AND c.outlet_id=$2 AND c.product_id=$3
        AND c.stock_movement_id=ANY($4::uuid[]) AND c.movement_type='CONSUME'
      ORDER BY c.created_at,c.id FOR UPDATE OF c,b`,
    [input.organisationId,input.outletId,input.productId,input.sourceMovementIds]
  );
  if (!consumptions.rowCount) return { tracked: false };

  let remaining = input.quantityUnits;
  for (const consumption of consumptions.rows) {
    if (remaining <= 0.0005) break;
    const restored = await client.query(
      `SELECT COALESCE(SUM(quantity_units),0) quantity
         FROM inventory_batch_movements
        WHERE organisation_id=$1 AND outlet_id=$2 AND product_id=$3 AND batch_id=$4
          AND source_movement_id=$5 AND movement_type='RESTOCK'`,
      [input.organisationId,input.outletId,input.productId,consumption.batch_id,consumption.stock_movement_id]
    );
    const unreturned = Number(consumption.quantity_units)-Number(restored.rows[0].quantity);
    if (unreturned <= 0.0005) continue;
    const take = Math.min(remaining,unreturned);
    if (consumption.expired) {
      throw Object.assign(new Error('Expired batch cannot be returned to saleable inventory'), { code: 'INVENTORY_BATCH_RETURN_EXPIRED' });
    }
    const updated = await client.query(
      `UPDATE inventory_batches SET remaining_units=remaining_units+$1
        WHERE id=$2 AND organisation_id=$3 AND outlet_id=$4 AND product_id=$5
          AND remaining_units+$1<=received_units RETURNING id`,
      [take,consumption.batch_id,input.organisationId,input.outletId,input.productId]
    );
    if (!updated.rowCount) throw Object.assign(new Error('Inventory batch return exceeds its received quantity'), { code: 'INVENTORY_BATCH_RETURN_MISMATCH' });
    await client.query(
      `INSERT INTO inventory_batch_movements(
         organisation_id,outlet_id,product_id,batch_id,stock_movement_id,source_movement_id,movement_type,direction,quantity_units
       ) VALUES($1,$2,$3,$4,$5,$6,'RESTOCK','INCREASE',$7)`,
      [input.organisationId,input.outletId,input.productId,consumption.batch_id,input.returnMovementId,consumption.stock_movement_id,take]
    );
    remaining -= take;
  }
  if (remaining > 0.0005) throw Object.assign(new Error('Batch return quantity exceeds the previously consumed quantity'), { code: 'INVENTORY_BATCH_RETURN_MISMATCH' });
  return { tracked: true };
}
