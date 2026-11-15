-- P591: retain original stock posting and an immutable trail for pre-preparation
-- quantity changes on unpaid packaged bar-tab lines.
ALTER TABLE bar_ticket_lines
  ADD COLUMN IF NOT EXISTS stock_movement_id UUID REFERENCES stock_movements(id) ON DELETE RESTRICT;

ALTER TABLE bar_ticket_lines
  DROP CONSTRAINT IF EXISTS bar_ticket_lines_quantity_check;

ALTER TABLE bar_ticket_lines
  ADD CONSTRAINT bar_ticket_lines_quantity_nonnegative CHECK (quantity >= 0);

CREATE TABLE IF NOT EXISTS bar_ticket_line_edit_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES outlets(id),
  ticket_id UUID NOT NULL REFERENCES bar_tickets(id) ON DELETE RESTRICT,
  ticket_line_id UUID NOT NULL REFERENCES bar_ticket_lines(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL,
  request_fingerprint CHAR(64) NOT NULL CHECK (request_fingerprint ~ '^[a-f0-9]{64}$'),
  previous_quantity NUMERIC(12,3) NOT NULL CHECK (previous_quantity > 0),
  requested_quantity NUMERIC(12,3) NOT NULL CHECK (requested_quantity >= 0),
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 3 AND 500),
  edited_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organisation_id, ticket_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS bar_ticket_line_stock_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES outlets(id),
  ticket_id UUID NOT NULL REFERENCES bar_tickets(id) ON DELETE RESTRICT,
  ticket_line_id UUID NOT NULL REFERENCES bar_ticket_lines(id) ON DELETE RESTRICT,
  edit_request_id UUID NOT NULL REFERENCES bar_ticket_line_edit_requests(id) ON DELETE RESTRICT,
  movement_id UUID NOT NULL REFERENCES stock_movements(id) ON DELETE RESTRICT,
  direction TEXT NOT NULL CHECK (direction IN ('SALE','RETURN')),
  quantity_units NUMERIC(14,3) NOT NULL CHECK (quantity_units > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (edit_request_id)
);

CREATE INDEX IF NOT EXISTS idx_bar_line_adjustments_line
  ON bar_ticket_line_stock_adjustments(ticket_line_id, created_at);
