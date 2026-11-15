import type { PoolClient } from 'pg';

export type CostConsumption = { coveredUnits: number; extendedCost: number; unitCost: number | null; fullyCosted: boolean };

/** Consume FIFO layers inside the caller's stock transaction. Never invent cost for uncovered stock. */
export async function consumeInventoryCostFifo(client: PoolClient, input: {
  organisationId: string; outletId: string; productId: string; quantityUnits: number;
  sourceType: string; sourceId: string; movementId?: string | null;
}): Promise<CostConsumption> {
  if (!Number.isFinite(input.quantityUnits) || input.quantityUnits <= 0) throw new Error('Invalid cost consumption quantity');
  const event = await client.query(
    `SELECT * FROM inventory_cost_consumption_events
      WHERE organisation_id=$1 AND outlet_id=$2 AND product_id=$3 AND source_type=$4 AND source_id=$5`,
    [input.organisationId,input.outletId,input.productId,input.sourceType,input.sourceId]
  );
  if(event.rowCount){
    const e=event.rows[0];
    if(Math.abs(Number(e.requested_units)-input.quantityUnits)>0.0005) throw new Error('INVENTORY_COST_EVENT_PAYLOAD_CONFLICT');
    return {coveredUnits:Number(e.covered_units),extendedCost:Number(e.extended_cost),
      unitCost:Number(e.covered_units)>0?Number(e.extended_cost)/Number(e.covered_units):null,fullyCosted:Boolean(e.fully_costed)};
  }
  let remaining = input.quantityUnits;
  let covered = 0;
  let cost = 0;
  const layers = await client.query(
    `SELECT * FROM inventory_cost_layers WHERE organisation_id=$1 AND outlet_id=$2 AND product_id=$3 AND remaining_units>0
      ORDER BY received_at,id FOR UPDATE`,
    [input.organisationId,input.outletId,input.productId]
  );
  for (const layer of layers.rows) {
    if (remaining <= 0.0005) break;
    const take = Math.min(remaining,Number(layer.remaining_units));
    const extended = Math.round(take*Number(layer.unit_cost)*100)/100;
    await client.query('UPDATE inventory_cost_layers SET remaining_units=remaining_units-$1 WHERE id=$2',[take,layer.id]);
    await client.query(`INSERT INTO inventory_cost_consumptions(organisation_id,outlet_id,product_id,cost_layer_id,movement_id,source_type,source_id,quantity_units,unit_cost,extended_cost)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [input.organisationId,input.outletId,input.productId,layer.id,input.movementId??null,input.sourceType,input.sourceId,take,layer.unit_cost,extended]);
    covered += take; cost += extended; remaining -= take;
  }
  await client.query(`INSERT INTO inventory_cost_consumption_events(organisation_id,outlet_id,product_id,source_type,source_id,requested_units,covered_units,extended_cost,fully_costed)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [input.organisationId,input.outletId,input.productId,input.sourceType,input.sourceId,input.quantityUnits,covered,cost,remaining<=0.0005]);
  if (remaining > 0.0005) {
    await client.query(`INSERT INTO inventory_cost_exceptions(organisation_id,outlet_id,product_id,source_type,source_id,requested_units,covered_units,reason)
      VALUES($1,$2,$3,$4,$5,$6,$7,'Insufficient FIFO cost-layer coverage; uncovered quantity is not assigned an assumed cost')
      ON CONFLICT DO NOTHING`,
      [input.organisationId,input.outletId,input.productId,input.sourceType,input.sourceId,input.quantityUnits,covered]);
  }
  return { coveredUnits:covered, extendedCost:Math.round(cost*100)/100, unitCost:covered>0?cost/covered:null, fullyCosted:remaining<=0.0005 };
}

export async function addInventoryCostLayer(client: PoolClient,input:{
 organisationId:string;outletId:string;productId:string; sourceType:'GOODS_RECEIPT'|'OPENING'|'RETURN'|'ADJUSTMENT'|'MANUAL_RECEIPT'|'INVENTORY_BATCH'|'STOCK_TRANSFER';
 sourceId:string;sourceLineId:string;quantityUnits:number;unitCost:number;receivedAt?:string;
}) {
 if(!Number.isFinite(input.quantityUnits)||input.quantityUnits<=0||!Number.isFinite(input.unitCost)||input.unitCost<0) throw new Error('Invalid inventory cost layer');
 const r=await client.query(`INSERT INTO inventory_cost_layers(organisation_id,outlet_id,product_id,source_type,source_id,source_line_id,received_units,remaining_units,unit_cost,received_at)
 VALUES($1,$2,$3,$4,$5,$6,$7,$7,$8,COALESCE($9::timestamptz,NOW()))
 ON CONFLICT(organisation_id,outlet_id,source_type,source_line_id) DO NOTHING RETURNING *`,
 [input.organisationId,input.outletId,input.productId,input.sourceType,input.sourceId,input.sourceLineId,input.quantityUnits,input.unitCost,input.receivedAt??null]);
 return r.rows[0]??null;
}
