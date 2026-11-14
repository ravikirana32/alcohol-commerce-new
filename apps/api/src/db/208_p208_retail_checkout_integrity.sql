-- P208: cover the retail stock lock path used by atomic checkout.
CREATE INDEX IF NOT EXISTS idx_stock_balances_org_outlet_product
  ON stock_balances(organisation_id, outlet_id, product_id);
