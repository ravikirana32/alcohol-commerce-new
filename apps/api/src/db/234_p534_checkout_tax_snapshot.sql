-- P534 continuation: bind each committed retail/bar sale line to the exact
-- immutable tax calculation snapshot used to price that line.
ALTER TABLE retail_sale_lines
  ADD COLUMN IF NOT EXISTS tax_snapshot_id UUID REFERENCES tax_calculation_snapshots(id);
ALTER TABLE bar_ticket_lines
  ADD COLUMN IF NOT EXISTS tax_snapshot_id UUID REFERENCES tax_calculation_snapshots(id);
CREATE INDEX IF NOT EXISTS idx_retail_sale_lines_tax_snapshot ON retail_sale_lines(tax_snapshot_id) WHERE tax_snapshot_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bar_ticket_lines_tax_snapshot ON bar_ticket_lines(tax_snapshot_id) WHERE tax_snapshot_id IS NOT NULL;
