-- P518: controlled inter-outlet transfers, stocktake snapshots and traceable batches.
CREATE TABLE IF NOT EXISTS stock_transfers (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 transfer_number TEXT NOT NULL, source_outlet_id UUID NOT NULL REFERENCES outlets(id), destination_outlet_id UUID NOT NULL REFERENCES outlets(id),
 status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','DISPATCHED','RECEIVED','CANCELLED')),
 notes TEXT, created_by UUID REFERENCES users(id), dispatched_by UUID REFERENCES users(id), received_by UUID REFERENCES users(id),
 dispatched_at TIMESTAMPTZ, received_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(organisation_id,transfer_number), CHECK(source_outlet_id<>destination_outlet_id)
);
CREATE TABLE IF NOT EXISTS stock_transfer_lines (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), transfer_id UUID NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
 product_id UUID NOT NULL REFERENCES products(id), requested_units NUMERIC(14,3) NOT NULL CHECK(requested_units>0),
 dispatched_units NUMERIC(14,3), received_units NUMERIC(14,3), variance_reason TEXT,
 UNIQUE(transfer_id,product_id), CHECK(dispatched_units IS NULL OR dispatched_units>0),
 CHECK(received_units IS NULL OR received_units>=0)
);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_org_status ON stock_transfers(organisation_id,status,created_at DESC);
CREATE TABLE IF NOT EXISTS inventory_batches (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 outlet_id UUID NOT NULL REFERENCES outlets(id), product_id UUID NOT NULL REFERENCES products(id), batch_number TEXT NOT NULL,
 received_units NUMERIC(14,3) NOT NULL CHECK(received_units>0), remaining_units NUMERIC(14,3) NOT NULL CHECK(remaining_units>=0),
 expiry_date DATE, received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_by UUID REFERENCES users(id),
 UNIQUE(organisation_id,outlet_id,product_id,batch_number), CHECK(remaining_units<=received_units)
);
CREATE INDEX IF NOT EXISTS idx_inventory_batches_expiry ON inventory_batches(organisation_id,outlet_id,expiry_date) WHERE remaining_units>0;
CREATE TABLE IF NOT EXISTS inventory_stocktakes (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 outlet_id UUID NOT NULL REFERENCES outlets(id), status TEXT NOT NULL DEFAULT 'COUNTING' CHECK(status IN ('COUNTING','SUBMITTED','APPROVED','REJECTED')),
 notes TEXT, counted_by UUID REFERENCES users(id), submitted_at TIMESTAMPTZ, approved_by UUID REFERENCES users(id), approved_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS inventory_stocktake_lines (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), stocktake_id UUID NOT NULL REFERENCES inventory_stocktakes(id) ON DELETE CASCADE,
 product_id UUID NOT NULL REFERENCES products(id), expected_units NUMERIC(14,3) NOT NULL CHECK(expected_units>=0),
 counted_units NUMERIC(14,3) NOT NULL CHECK(counted_units>=0), variance_units NUMERIC(14,3) GENERATED ALWAYS AS (counted_units-expected_units) STORED,
 UNIQUE(stocktake_id,product_id)
);
CREATE INDEX IF NOT EXISTS idx_inventory_stocktakes_org_status ON inventory_stocktakes(organisation_id,status,created_at DESC);
