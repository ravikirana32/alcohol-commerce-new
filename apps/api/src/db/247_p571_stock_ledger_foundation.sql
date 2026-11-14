-- P571: signed adjustment semantics and immutable outlet opening-stock baselines.
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS adjustment_direction TEXT;
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_adjustment_direction_check;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_adjustment_direction_check
  CHECK (adjustment_direction IS NULL OR adjustment_direction IN ('INCREASE','DECREASE'));
CREATE OR REPLACE FUNCTION enforce_new_stock_adjustment_direction() RETURNS trigger AS $$
BEGIN
  IF NEW.movement_type='ADJUSTMENT' AND NEW.adjustment_direction IS NULL THEN
    RAISE EXCEPTION 'adjustment_direction is required for new ADJUSTMENT movements' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_stock_adjustment_direction_required ON stock_movements;
CREATE TRIGGER trg_stock_adjustment_direction_required
  BEFORE INSERT ON stock_movements FOR EACH ROW EXECUTE FUNCTION enforce_new_stock_adjustment_direction();
CREATE TABLE IF NOT EXISTS stock_opening_balance_snapshots (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id),
 outlet_id UUID NOT NULL REFERENCES outlets(id), captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 captured_by UUID REFERENCES users(id), reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 3 AND 500),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(organisation_id,outlet_id)
);
CREATE TABLE IF NOT EXISTS stock_opening_balance_lines (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), snapshot_id UUID NOT NULL REFERENCES stock_opening_balance_snapshots(id),
 organisation_id UUID NOT NULL REFERENCES organisations(id), outlet_id UUID NOT NULL REFERENCES outlets(id),
 product_id UUID NOT NULL REFERENCES products(id), quantity_units NUMERIC(14,3) NOT NULL CHECK(quantity_units >= 0),
 UNIQUE(snapshot_id,product_id)
);
CREATE INDEX IF NOT EXISTS idx_stock_opening_lines_scope ON stock_opening_balance_lines(organisation_id,outlet_id,product_id);
