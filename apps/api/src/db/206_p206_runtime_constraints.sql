-- P206: constraints supporting stable runtime and tenant-safe lookups.
CREATE INDEX IF NOT EXISTS idx_retail_sales_org_outlet_sold_at
  ON retail_sales(organisation_id, outlet_id, sold_at DESC);
CREATE INDEX IF NOT EXISTS idx_bar_tickets_org_outlet_opened_at
  ON bar_tickets(organisation_id, outlet_id, opened_at DESC);
