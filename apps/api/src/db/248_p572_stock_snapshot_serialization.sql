-- P572: serialize ledger writes with opening-baseline capture at outlet scope.
-- Every movement insert holds this transaction-scoped lock until its balance mutation commits.
CREATE OR REPLACE FUNCTION lock_stock_outlet_ledger_scope() RETURNS trigger AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.organisation_id::text || ':' || NEW.outlet_id::text, 0));
  -- NOW() is transaction-start time and can predate a lock wait. Record the actual insert boundary.
  NEW.created_at := clock_timestamp();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_stock_movement_scope_serialization ON stock_movements;
CREATE TRIGGER trg_stock_movement_scope_serialization
  BEFORE INSERT ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION lock_stock_outlet_ledger_scope();
CREATE INDEX IF NOT EXISTS idx_stock_movements_scope_created
  ON stock_movements(organisation_id,outlet_id,created_at,product_id);
