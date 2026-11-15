-- P593: route a ticket's preparation lines into one KOT per configured station.
CREATE TABLE IF NOT EXISTS bar_kot_stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  station_code TEXT NOT NULL CHECK (length(trim(station_code)) BETWEEN 1 AND 30),
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organisation_id,outlet_id,station_code),
  UNIQUE (id,organisation_id,outlet_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bar_kot_default_station
  ON bar_kot_stations(organisation_id,outlet_id) WHERE is_default AND status='ACTIVE';

CREATE TABLE IF NOT EXISTS bar_kot_product_stations (
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  station_id UUID NOT NULL,
  assigned_by UUID REFERENCES users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organisation_id,outlet_id,product_id),
  FOREIGN KEY (station_id,organisation_id,outlet_id)
    REFERENCES bar_kot_stations(id,organisation_id,outlet_id) ON DELETE RESTRICT
);

ALTER TABLE bar_kot_orders
  DROP CONSTRAINT IF EXISTS bar_kot_orders_ticket_id_key;
ALTER TABLE bar_kot_orders
  ADD COLUMN IF NOT EXISTS station_id UUID;
DO $$ BEGIN
  ALTER TABLE bar_kot_orders ADD CONSTRAINT fk_bar_kot_station_scope
    FOREIGN KEY (station_id,organisation_id,outlet_id)
    REFERENCES bar_kot_stations(id,organisation_id,outlet_id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS uq_bar_kot_order_ticket_station
  ON bar_kot_orders(ticket_id,station_id) WHERE station_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_bar_kot_order_ticket_unrouted
  ON bar_kot_orders(ticket_id) WHERE station_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_bar_kot_station_queue
  ON bar_kot_orders(organisation_id,outlet_id,station_id,status,created_at);
