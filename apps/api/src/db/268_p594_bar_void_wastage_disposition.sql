-- P594: capture how stock is dispositioned when an unpaid bar ticket is voided.
ALTER TABLE bar_ticket_void_requests
  ADD COLUMN IF NOT EXISTS inventory_disposition TEXT NOT NULL DEFAULT 'RESTOCKED';
ALTER TABLE bar_ticket_void_requests
  ADD COLUMN IF NOT EXISTS approval_request_id UUID REFERENCES bar_ticket_approval_requests(id) ON DELETE RESTRICT;
DO $$ BEGIN
  ALTER TABLE bar_ticket_void_requests ADD CONSTRAINT ck_bar_ticket_void_inventory_disposition
    CHECK (inventory_disposition IN ('RESTOCKED','WASTAGE'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS bar_ticket_void_disposition_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  void_request_id UUID NOT NULL REFERENCES bar_ticket_void_requests(id) ON DELETE RESTRICT,
  ticket_line_id UUID NOT NULL REFERENCES bar_ticket_lines(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  line_type TEXT NOT NULL CHECK (line_type IN ('PEG','BOTTLE','PACKAGED')),
  quantity NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
  volume_ml NUMERIC(12,3) CHECK (volume_ml IS NULL OR volume_ml > 0),
  disposition TEXT NOT NULL CHECK (disposition IN ('RESTOCKED','WASTAGE')),
  stock_movement_id UUID REFERENCES stock_movements(id) ON DELETE RESTRICT,
  cost_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (cost_amount >= 0),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (void_request_id,ticket_line_id)
);

CREATE INDEX IF NOT EXISTS idx_bar_void_disposition_ticket_line
  ON bar_ticket_void_disposition_lines(organisation_id,outlet_id,ticket_line_id,created_at);
