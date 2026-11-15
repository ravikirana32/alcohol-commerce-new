-- P595: outlet menu availability and versioned recipe/BOM stock depletion.
ALTER TABLE stock_transfer_lines
  ADD COLUMN IF NOT EXISTS batch_tracked BOOLEAN NOT NULL DEFAULT FALSE;

INSERT INTO inventory_batches(
  organisation_id,outlet_id,product_id,batch_number,received_units,remaining_units,expiry_date
)
SELECT b.organisation_id,b.outlet_id,b.product_id,'UNTRACKED-'||b.id::text,
       GREATEST(b.quantity_units-COALESCE(lots.remaining_units,0),0),
       GREATEST(b.quantity_units-COALESCE(lots.remaining_units,0),0),NULL
  FROM stock_balances b
  LEFT JOIN LATERAL (
    SELECT SUM(i.remaining_units) AS remaining_units
      FROM inventory_batches i
     WHERE i.organisation_id=b.organisation_id AND i.outlet_id=b.outlet_id AND i.product_id=b.product_id
  ) lots ON TRUE
 WHERE b.quantity_units>COALESCE(lots.remaining_units,0);

CREATE TABLE IF NOT EXISTS bar_product_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  version_no INTEGER NOT NULL CHECK (version_no > 0),
  yield_quantity NUMERIC(12,3) NOT NULL DEFAULT 1 CHECK (yield_quantity > 0),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ACTIVE','ARCHIVED')),
  created_by UUID REFERENCES users(id),
  activated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  UNIQUE (organisation_id,product_id,version_no),
  UNIQUE (id,organisation_id,product_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bar_product_recipe_active
  ON bar_product_recipes(organisation_id,product_id) WHERE status='ACTIVE';

CREATE TABLE IF NOT EXISTS bar_product_recipe_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  ingredient_product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (recipe_id,organisation_id,product_id)
    REFERENCES bar_product_recipes(id,organisation_id,product_id) ON DELETE CASCADE,
  UNIQUE (recipe_id,ingredient_product_id),
  CHECK (product_id<>ingredient_product_id)
);

CREATE INDEX IF NOT EXISTS idx_bar_recipe_lines_recipe
  ON bar_product_recipe_lines(organisation_id,recipe_id);

CREATE TABLE IF NOT EXISTS bar_menu_availability (
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  measure_type TEXT NOT NULL CHECK (measure_type IN ('PEG','BOTTLE','PACKAGED')),
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  reason TEXT,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organisation_id,outlet_id,product_id,measure_type)
);

ALTER TABLE retail_sale_lines
  ADD COLUMN IF NOT EXISTS stock_movement_id UUID REFERENCES stock_movements(id) ON DELETE RESTRICT;

ALTER TABLE inventory_cost_layers
  DROP CONSTRAINT IF EXISTS inventory_cost_layers_source_type_check;
ALTER TABLE inventory_cost_layers
  ADD CONSTRAINT inventory_cost_layers_source_type_check
  CHECK (source_type IN ('GOODS_RECEIPT','OPENING','RETURN','ADJUSTMENT','MANUAL_RECEIPT','INVENTORY_BATCH','STOCK_TRANSFER'));

CREATE TABLE IF NOT EXISTS inventory_batch_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  batch_id UUID NOT NULL REFERENCES inventory_batches(id) ON DELETE RESTRICT,
  stock_movement_id UUID NOT NULL REFERENCES stock_movements(id) ON DELETE RESTRICT,
  source_movement_id UUID REFERENCES stock_movements(id) ON DELETE RESTRICT,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('CONSUME','RESTOCK','RECEIPT','COUNT')),
  direction TEXT NOT NULL CHECK (direction IN ('INCREASE','DECREASE')),
  quantity_units NUMERIC(14,3) NOT NULL CHECK (quantity_units > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((movement_type='CONSUME' AND direction='DECREASE' AND source_movement_id IS NULL) OR
         (movement_type='RESTOCK' AND direction='INCREASE' AND source_movement_id IS NOT NULL) OR
         (movement_type='RECEIPT' AND direction='INCREASE' AND source_movement_id IS NULL) OR
         (movement_type='COUNT')),
  UNIQUE (stock_movement_id,batch_id,movement_type,source_movement_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_batch_movements_source
  ON inventory_batch_movements(organisation_id,outlet_id,product_id,source_movement_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_batch_movement_without_source
  ON inventory_batch_movements(stock_movement_id,batch_id,movement_type)
  WHERE source_movement_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_batch_movement_with_source
  ON inventory_batch_movements(stock_movement_id,batch_id,movement_type,source_movement_id)
  WHERE source_movement_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS stock_transfer_batch_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  transfer_line_id UUID NOT NULL REFERENCES stock_transfer_lines(id) ON DELETE CASCADE,
  source_batch_id UUID NOT NULL REFERENCES inventory_batches(id) ON DELETE RESTRICT,
  destination_batch_id UUID REFERENCES inventory_batches(id) ON DELETE RESTRICT,
  dispatched_units NUMERIC(14,3) NOT NULL CHECK (dispatched_units>0),
  received_units NUMERIC(14,3) CHECK (received_units IS NULL OR (received_units>=0 AND received_units<=dispatched_units)),
  UNIQUE (transfer_line_id,source_batch_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_transfer_batch_lines
  ON stock_transfer_batch_lines(organisation_id,transfer_line_id);

CREATE TABLE IF NOT EXISTS inventory_stocktake_batch_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stocktake_id UUID NOT NULL REFERENCES inventory_stocktakes(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  batch_id UUID NOT NULL REFERENCES inventory_batches(id) ON DELETE RESTRICT,
  expected_units NUMERIC(14,3) NOT NULL CHECK (expected_units>=0),
  counted_units NUMERIC(14,3) NOT NULL CHECK (counted_units>=0),
  variance_units NUMERIC(14,3) GENERATED ALWAYS AS (counted_units-expected_units) STORED,
  UNIQUE (stocktake_id,batch_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_stocktake_batch_lines
  ON inventory_stocktake_batch_lines(stocktake_id,product_id);

CREATE TABLE IF NOT EXISTS bar_ticket_recipe_consumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  ticket_line_id UUID NOT NULL REFERENCES bar_ticket_lines(id) ON DELETE RESTRICT,
  recipe_id UUID NOT NULL REFERENCES bar_product_recipes(id) ON DELETE RESTRICT,
  recipe_line_id UUID NOT NULL REFERENCES bar_product_recipe_lines(id) ON DELETE RESTRICT,
  ingredient_product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  stock_movement_id UUID NOT NULL REFERENCES stock_movements(id) ON DELETE RESTRICT,
  quantity_units NUMERIC(14,3) NOT NULL CHECK (quantity_units > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ticket_line_id,recipe_line_id,stock_movement_id)
);

CREATE INDEX IF NOT EXISTS idx_bar_recipe_consumption_ticket_line
  ON bar_ticket_recipe_consumptions(organisation_id,outlet_id,ticket_line_id);
