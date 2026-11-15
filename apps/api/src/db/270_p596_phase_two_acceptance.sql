-- P596: complete Phase 2 menu modifiers, combo recipe labels, and inventory evidence.
ALTER TABLE bar_product_recipes
  ADD COLUMN IF NOT EXISTS recipe_kind TEXT NOT NULL DEFAULT 'RECIPE'
    CHECK (recipe_kind IN ('RECIPE','COMBO'));

CREATE TABLE IF NOT EXISTS bar_modifier_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  min_selections SMALLINT NOT NULL DEFAULT 0 CHECK (min_selections >= 0),
  max_selections SMALLINT NOT NULL DEFAULT 1 CHECK (max_selections > 0),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (min_selections <= max_selections),
  UNIQUE (id,organisation_id,product_id)
);

CREATE TABLE IF NOT EXISTS bar_modifier_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  group_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  price_delta NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price_delta >= -999999),
  ingredient_product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
  ingredient_quantity NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (ingredient_quantity >= 0),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (group_id,organisation_id,product_id)
    REFERENCES bar_modifier_groups(id,organisation_id,product_id) ON DELETE CASCADE,
  CHECK ((ingredient_product_id IS NULL AND ingredient_quantity=0) OR
         (ingredient_product_id IS NOT NULL AND ingredient_quantity>0)),
  UNIQUE (group_id,name)
);

CREATE INDEX IF NOT EXISTS idx_bar_modifier_groups_product
  ON bar_modifier_groups(organisation_id,product_id,status);
CREATE INDEX IF NOT EXISTS idx_bar_modifier_options_group
  ON bar_modifier_options(organisation_id,group_id,status);

CREATE TABLE IF NOT EXISTS bar_ticket_line_modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  ticket_line_id UUID NOT NULL REFERENCES bar_ticket_lines(id) ON DELETE RESTRICT,
  group_id UUID NOT NULL REFERENCES bar_modifier_groups(id) ON DELETE RESTRICT,
  option_id UUID NOT NULL REFERENCES bar_modifier_options(id) ON DELETE RESTRICT,
  group_name TEXT NOT NULL,
  option_name TEXT NOT NULL,
  price_delta NUMERIC(12,2) NOT NULL,
  ingredient_product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
  ingredient_quantity NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (ingredient_quantity>=0),
  UNIQUE (ticket_line_id,option_id)
);

CREATE TABLE IF NOT EXISTS bar_ticket_modifier_consumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  modifier_id UUID NOT NULL REFERENCES bar_ticket_line_modifiers(id) ON DELETE RESTRICT,
  ingredient_product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  stock_movement_id UUID NOT NULL REFERENCES stock_movements(id) ON DELETE RESTRICT,
  quantity_units NUMERIC(14,3) NOT NULL CHECK (quantity_units>0),
  UNIQUE (modifier_id,stock_movement_id)
);

ALTER TABLE peg_transactions
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS request_fingerprint TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_peg_transactions_idempotency
  ON peg_transactions(organisation_id,outlet_id,idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE supplier_invoices
  ADD COLUMN IF NOT EXISTS reference TEXT,
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (tax_amount>=0),
  ADD COLUMN IF NOT EXISTS purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_po
  ON supplier_invoices(organisation_id,purchase_order_id,invoice_date DESC);
ALTER TABLE supplier_invoice_match_runs
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS request_fingerprint TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_supplier_invoice_match_idempotency
  ON supplier_invoice_match_runs(organisation_id,idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS supplier_invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  supplier_invoice_id UUID NOT NULL REFERENCES supplier_invoices(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity_units NUMERIC(14,3) NOT NULL CHECK (quantity_units>0),
  unit_cost NUMERIC(14,4) NOT NULL CHECK (unit_cost>=0),
  line_amount NUMERIC(14,2) NOT NULL CHECK (line_amount>=0),
  UNIQUE (supplier_invoice_id,product_id)
);

CREATE TABLE IF NOT EXISTS supplier_invoice_match_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  match_run_id UUID NOT NULL REFERENCES supplier_invoice_match_runs(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (decision IN ('ACCEPTED','REJECTED')),
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 3 AND 1000),
  decided_by UUID NOT NULL REFERENCES users(id),
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (match_run_id)
);

ALTER TABLE inventory_cost_layers
  DROP CONSTRAINT IF EXISTS inventory_cost_layers_source_type_check;
ALTER TABLE inventory_cost_layers
  ADD CONSTRAINT inventory_cost_layers_source_type_check
  CHECK (source_type IN ('GOODS_RECEIPT','OPENING','RETURN','ADJUSTMENT','MANUAL_RECEIPT','INVENTORY_BATCH','STOCK_TRANSFER','WASTAGE'));
