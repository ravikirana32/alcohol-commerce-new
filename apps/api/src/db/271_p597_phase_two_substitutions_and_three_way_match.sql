-- P597: persist menu ingredient substitutions and purchase-order comparison evidence.
ALTER TABLE bar_modifier_groups
  ADD COLUMN IF NOT EXISTS substitutes_product_id UUID REFERENCES products(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_bar_modifier_group_substitution_target
  ON bar_modifier_groups(organisation_id,product_id,substitutes_product_id)
  WHERE substitutes_product_id IS NOT NULL;

ALTER TABLE bar_ticket_line_modifiers
  ADD COLUMN IF NOT EXISTS substitutes_product_id UUID REFERENCES products(id) ON DELETE RESTRICT;

ALTER TABLE supplier_invoice_match_runs
  ADD COLUMN IF NOT EXISTS purchase_order_quantity_variance NUMERIC(14,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS purchase_order_value_variance NUMERIC(14,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS supplier_invoice_match_receipts (
  match_run_id UUID NOT NULL REFERENCES supplier_invoice_match_runs(id) ON DELETE CASCADE,
  goods_receipt_id UUID NOT NULL REFERENCES goods_receipts(id) ON DELETE RESTRICT,
  PRIMARY KEY (match_run_id,goods_receipt_id)
);
