-- P203: server-authoritative, outlet-scoped prices for retail and bar service.
CREATE TABLE IF NOT EXISTS outlet_product_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  channel TEXT NOT NULL CHECK (channel IN ('RETAIL','BAR_BOTTLE','BAR_PACKAGED','BAR_PEG')),
  volume_ml INTEGER,
  unit_price NUMERIC(14,2) NOT NULL CHECK (unit_price >= 0),
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate <= 100),
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_until TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((channel = 'BAR_PEG' AND volume_ml IS NOT NULL AND volume_ml > 0)
      OR (channel <> 'BAR_PEG' AND volume_ml IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_outlet_prices_current
  ON outlet_product_prices(organisation_id, outlet_id, channel, product_id, effective_from DESC)
  WHERE effective_until IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_outlet_price_active
  ON outlet_product_prices(outlet_id, product_id, channel, COALESCE(volume_ml, 0))
  WHERE effective_until IS NULL;
ALTER TABLE bar_tickets ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_bar_ticket_idempotency
  ON bar_tickets(outlet_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
