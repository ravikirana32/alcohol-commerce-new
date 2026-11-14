-- P537: immutable trade fulfilment evidence. This supplements, rather than replaces,
-- the P523 trade order state machine. Receipt is not an inventory GRN posting.
CREATE TABLE IF NOT EXISTS trade_order_fulfilment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_order_id UUID NOT NULL REFERENCES trade_orders(id) ON DELETE RESTRICT,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (event_type IN ('DISPATCH_NOTE','CARRIER_HANDOFF','DELIVERY_ATTEMPT','BUYER_RECEIPT','RECEIPT_EXCEPTION')),
  reference_number TEXT,
  quantity_received NUMERIC(14,3),
  notes TEXT,
  evidence_uri TEXT,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (quantity_received IS NULL OR quantity_received >= 0),
  CHECK (length(coalesce(notes,'')) <= 2000),
  CHECK (length(coalesce(evidence_uri,'')) <= 1000)
);
CREATE INDEX IF NOT EXISTS idx_trade_fulfilment_order_time
  ON trade_order_fulfilment_events(trade_order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trade_fulfilment_org_time
  ON trade_order_fulfilment_events(organisation_id, created_at DESC);
CREATE OR REPLACE FUNCTION prevent_trade_fulfilment_event_mutation() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'Trade fulfilment evidence is append-only'; END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_trade_fulfilment_event_immutable ON trade_order_fulfilment_events;
CREATE TRIGGER trg_trade_fulfilment_event_immutable
BEFORE UPDATE OR DELETE ON trade_order_fulfilment_events
FOR EACH ROW EXECUTE FUNCTION prevent_trade_fulfilment_event_mutation();
