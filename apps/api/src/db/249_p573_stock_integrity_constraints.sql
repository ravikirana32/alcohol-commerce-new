-- P573: stock integrity constraints and reconciliation evidence hardening.
ALTER TABLE stock_reconciliation_runs
  ADD COLUMN IF NOT EXISTS ledger_cutoff_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS baseline_snapshot_id UUID REFERENCES stock_opening_balance_snapshots(id);
ALTER TABLE stock_reconciliation_exceptions
  ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_reviewed_by UUID REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_adjustment_unclassified
  ON stock_movements(organisation_id,outlet_id,product_id) WHERE movement_type='ADJUSTMENT' AND adjustment_direction IS NULL;
CREATE INDEX IF NOT EXISTS idx_stock_balances_reconciliation
  ON stock_balances(organisation_id,outlet_id,product_id);
