-- P590: retain an immutable reason and actor for each KOT reprint.
CREATE TABLE IF NOT EXISTS bar_kot_reprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES outlets(id),
  kot_id UUID NOT NULL REFERENCES bar_kot_orders(id) ON DELETE RESTRICT,
  printed_by UUID REFERENCES users(id),
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 3 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
