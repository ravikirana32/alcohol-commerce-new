import type { PoolClient } from 'pg';

/**
 * Reconciliation deliberately excludes ADJUSTMENT from arithmetic: legacy rows
 * store a positive quantity and do not persist the sign of the adjustment.
 * Those rows are surfaced as exceptions rather than guessed.
 */
export async function collectStockReconciliation(client: PoolClient, organisationId: string, outletId: string, cutoffAt?: string) {
  const rows = await client.query(
    `SELECT p.id AS product_id,
       COALESCE(b.quantity_units,0)::numeric(14,3) AS balance_quantity,
       COALESCE(ob.quantity_units,0) + COALESCE(SUM(CASE
         WHEN sm.movement_type IN ('RECEIPT','TRANSFER_IN','RETURN') THEN sm.quantity_units
         WHEN sm.movement_type IN ('SALE','TRANSFER_OUT','WASTAGE','SUPPLIER_RETURN') THEN -sm.quantity_units
         WHEN sm.movement_type='ADJUSTMENT' AND sm.adjustment_direction='INCREASE' THEN sm.quantity_units
         WHEN sm.movement_type='ADJUSTMENT' AND sm.adjustment_direction='DECREASE' THEN -sm.quantity_units
         ELSE 0 END),0)::numeric(14,3) AS ledger_quantity,
       COUNT(sm.id) FILTER (WHERE sm.movement_type='ADJUSTMENT' AND sm.adjustment_direction IS NULL)::int AS unclassified_adjustments,
       (b.product_id IS NULL) AS missing_balance
     FROM products p
     LEFT JOIN stock_balances b ON b.organisation_id=p.organisation_id AND b.outlet_id=$2 AND b.product_id=p.id
     LEFT JOIN stock_opening_balance_lines ob ON ob.organisation_id=p.organisation_id AND ob.outlet_id=$2 AND ob.product_id=p.id
     LEFT JOIN stock_opening_balance_snapshots os ON os.id=ob.snapshot_id AND os.organisation_id=p.organisation_id AND os.outlet_id=$2
     LEFT JOIN stock_movements sm ON sm.organisation_id=p.organisation_id AND sm.outlet_id=$2 AND sm.product_id=p.id AND (os.captured_at IS NULL OR sm.created_at >= os.captured_at) AND ($3::timestamptz IS NULL OR sm.created_at <= $3::timestamptz)
     WHERE p.organisation_id=$1 AND p.status='ACTIVE'
     GROUP BY p.id,b.product_id,b.quantity_units,ob.quantity_units,os.captured_at
     ORDER BY p.id`, [organisationId,outletId,cutoffAt ?? null]
  );
  return rows.rows;
}
