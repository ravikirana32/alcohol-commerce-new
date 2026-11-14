-- P565: READ-ONLY stock ledger integrity diagnostics.
-- Run against a disposable/staging database first. This file contains SELECTs only.
-- A balance-vs-ledger difference is diagnostic, not automatically a defect: older
-- installations may have opening stock balances predating stock_movements.

-- 1) Movement rows whose outlet or product is outside the movement organisation.
SELECT sm.id, sm.organisation_id, sm.outlet_id, sm.product_id,
       o.organisation_id AS outlet_organisation_id,
       p.organisation_id AS product_organisation_id
FROM stock_movements sm
LEFT JOIN outlets o ON o.id = sm.outlet_id
LEFT JOIN products p ON p.id = sm.product_id
WHERE o.id IS NULL OR p.id IS NULL
   OR o.organisation_id <> sm.organisation_id
   OR p.organisation_id <> sm.organisation_id;

-- 2) Stock balance rows whose outlet or product is outside the balance organisation.
SELECT sb.id, sb.organisation_id, sb.outlet_id, sb.product_id,
       o.organisation_id AS outlet_organisation_id,
       p.organisation_id AS product_organisation_id
FROM stock_balances sb
LEFT JOIN outlets o ON o.id = sb.outlet_id
LEFT JOIN products p ON p.id = sb.product_id
WHERE o.id IS NULL OR p.id IS NULL
   OR o.organisation_id <> sb.organisation_id
   OR p.organisation_id <> sb.organisation_id;

-- 3) Repeated document/product/type references. Review before treating as duplicates:
-- some workflows may legitimately split a document into multiple movement rows.
SELECT organisation_id, outlet_id, product_id, movement_type,
       reference_type, reference_id, COUNT(*) AS movement_count,
       SUM(quantity_units) AS total_units
FROM stock_movements
WHERE reference_type IS NOT NULL AND reference_id IS NOT NULL
GROUP BY organisation_id, outlet_id, product_id, movement_type, reference_type, reference_id
HAVING COUNT(*) > 1
ORDER BY movement_count DESC, reference_type, reference_id;

-- 4) Balance compared with signed movement history. This does NOT account for
-- opening balances or movement types whose sign semantics need business review.
-- Treat differences as reconciliation candidates, not automatic failures.
WITH signed_movements AS (
  SELECT organisation_id, outlet_id, product_id,
         SUM(CASE
           WHEN movement_type IN ('RECEIPT','TRANSFER_IN','RETURN') THEN quantity_units
           WHEN movement_type IN ('SALE','TRANSFER_OUT','WASTAGE') THEN -quantity_units
           WHEN movement_type = 'ADJUSTMENT' THEN NULL
           ELSE NULL
         END) AS signed_units,
         COUNT(*) FILTER (WHERE movement_type = 'ADJUSTMENT') AS adjustment_rows
  FROM stock_movements
  GROUP BY organisation_id, outlet_id, product_id
)
SELECT sb.organisation_id, sb.outlet_id, sb.product_id,
       sb.quantity_units AS current_balance,
       sm.signed_units AS movement_net_excluding_adjustments,
       sm.adjustment_rows
FROM stock_balances sb
JOIN signed_movements sm USING (organisation_id, outlet_id, product_id)
WHERE sm.adjustment_rows = 0
  AND ABS(sb.quantity_units - sm.signed_units) > 0.001
ORDER BY sb.organisation_id, sb.outlet_id, sb.product_id;

-- 5) Inventory batches compared with their originating receipt movements.
-- This is a candidate report: batch creation may have occurred through several
-- historical paths and not every batch has a one-to-one movement reference.
SELECT b.id AS batch_id, b.organisation_id, b.outlet_id, b.product_id,
       b.received_units,
       COALESCE(SUM(sm.quantity_units), 0) AS linked_receipt_units
FROM inventory_batches b
LEFT JOIN stock_movements sm
  ON sm.organisation_id = b.organisation_id
 AND sm.outlet_id = b.outlet_id
 AND sm.product_id = b.product_id
 AND sm.reference_type = 'INVENTORY_BATCH'
 AND sm.reference_id = b.id
 AND sm.movement_type = 'RECEIPT'
GROUP BY b.id, b.organisation_id, b.outlet_id, b.product_id, b.received_units
HAVING ABS(b.received_units - COALESCE(SUM(sm.quantity_units), 0)) > 0.001;
