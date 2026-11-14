-- P575: FIFO inventory cost layers and consumption evidence.
CREATE TABLE IF NOT EXISTS inventory_cost_layers (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id),
 outlet_id UUID NOT NULL REFERENCES outlets(id), product_id UUID NOT NULL REFERENCES products(id),
 source_type TEXT NOT NULL CHECK(source_type IN ('GOODS_RECEIPT','OPENING','RETURN','ADJUSTMENT','MANUAL_RECEIPT','INVENTORY_BATCH')),
 source_id UUID NOT NULL, source_line_id UUID,
 received_units NUMERIC(14,3) NOT NULL CHECK(received_units>0),
 remaining_units NUMERIC(14,3) NOT NULL CHECK(remaining_units>=0 AND remaining_units<=received_units),
 unit_cost NUMERIC(14,4) NOT NULL CHECK(unit_cost>=0), currency CHAR(3) NOT NULL DEFAULT 'INR',
 received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(organisation_id,outlet_id,source_type,source_line_id)
);
CREATE INDEX IF NOT EXISTS idx_inventory_cost_layers_fifo ON inventory_cost_layers(organisation_id,outlet_id,product_id,received_at,id) WHERE remaining_units>0;
CREATE TABLE IF NOT EXISTS inventory_cost_consumptions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id),
 outlet_id UUID NOT NULL REFERENCES outlets(id), product_id UUID NOT NULL REFERENCES products(id),
 cost_layer_id UUID NOT NULL REFERENCES inventory_cost_layers(id), movement_id UUID REFERENCES stock_movements(id),
 source_type TEXT NOT NULL, source_id UUID NOT NULL, quantity_units NUMERIC(14,3) NOT NULL CHECK(quantity_units>0),
 unit_cost NUMERIC(14,4) NOT NULL CHECK(unit_cost>=0), extended_cost NUMERIC(14,2) NOT NULL CHECK(extended_cost>=0),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inventory_cost_consumptions_source ON inventory_cost_consumptions(organisation_id,source_type,source_id);
CREATE TABLE IF NOT EXISTS inventory_cost_consumption_events (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id),
 outlet_id UUID NOT NULL REFERENCES outlets(id), product_id UUID NOT NULL REFERENCES products(id),
 source_type TEXT NOT NULL, source_id UUID NOT NULL, requested_units NUMERIC(14,3) NOT NULL CHECK(requested_units>0),
 covered_units NUMERIC(14,3) NOT NULL DEFAULT 0, extended_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
 fully_costed BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(organisation_id,outlet_id,product_id,source_type,source_id)
);
CREATE TABLE IF NOT EXISTS inventory_cost_exceptions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id),
 outlet_id UUID NOT NULL REFERENCES outlets(id), product_id UUID NOT NULL REFERENCES products(id),
 source_type TEXT NOT NULL, source_id UUID NOT NULL, requested_units NUMERIC(14,3) NOT NULL,
 covered_units NUMERIC(14,3) NOT NULL, status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','RESOLVED','ACCEPTED')),
 reason TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(organisation_id,outlet_id,product_id,source_type,source_id)
);
