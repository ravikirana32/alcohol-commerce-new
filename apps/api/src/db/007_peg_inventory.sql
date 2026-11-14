CREATE TABLE IF NOT EXISTS peg_measures (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 name TEXT NOT NULL, volume_ml INTEGER NOT NULL CHECK(volume_ml > 0), is_default BOOLEAN NOT NULL DEFAULT FALSE,
 UNIQUE(organisation_id,name)
);
CREATE TABLE IF NOT EXISTS open_bottles (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 outlet_id UUID NOT NULL REFERENCES outlets(id), product_id UUID NOT NULL REFERENCES products(id),
 source_movement_id UUID REFERENCES stock_movements(id), bottle_volume_ml INTEGER NOT NULL CHECK(bottle_volume_ml > 0),
 remaining_ml INTEGER NOT NULL CHECK(remaining_ml >= 0), opened_by UUID REFERENCES users(id),
 status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','EMPTY','CLOSED','VARIANCE')),
 opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), closed_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS peg_transactions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 outlet_id UUID NOT NULL REFERENCES outlets(id), open_bottle_id UUID NOT NULL REFERENCES open_bottles(id),
 product_id UUID NOT NULL REFERENCES products(id), measure_id UUID REFERENCES peg_measures(id),
 volume_ml INTEGER NOT NULL CHECK(volume_ml > 0), transaction_type TEXT NOT NULL CHECK(transaction_type IN ('SALE','WASTAGE','COMPLIMENTARY','ADJUSTMENT')),
 reference_id UUID, notes TEXT, performed_by UUID REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_open_bottles_outlet ON open_bottles(outlet_id,status);
