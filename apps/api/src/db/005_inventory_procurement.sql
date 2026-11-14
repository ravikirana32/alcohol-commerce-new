CREATE TABLE IF NOT EXISTS suppliers (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 name TEXT NOT NULL, supplier_code TEXT, contact JSONB NOT NULL DEFAULT '{}'::jsonb, status TEXT NOT NULL DEFAULT 'ACTIVE',
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(organisation_id,supplier_code)
);
CREATE TABLE IF NOT EXISTS stock_balances (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 outlet_id UUID NOT NULL REFERENCES outlets(id), product_id UUID NOT NULL REFERENCES products(id),
 quantity_units NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK(quantity_units >= 0),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(outlet_id,product_id)
);
CREATE TABLE IF NOT EXISTS stock_movements (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 outlet_id UUID NOT NULL REFERENCES outlets(id), product_id UUID NOT NULL REFERENCES products(id),
 movement_type TEXT NOT NULL CHECK(movement_type IN ('RECEIPT','SALE','TRANSFER_IN','TRANSFER_OUT','WASTAGE','ADJUSTMENT','RETURN')),
 quantity_units NUMERIC(14,3) NOT NULL CHECK(quantity_units > 0), reference_type TEXT, reference_id UUID,
 notes TEXT, created_by UUID REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS purchase_orders (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 outlet_id UUID NOT NULL REFERENCES outlets(id), supplier_id UUID REFERENCES suppliers(id),
 po_number TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','SUBMITTED','PART_RECEIVED','RECEIVED','CANCELLED')),
 expected_at DATE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(organisation_id,po_number)
);
CREATE TABLE IF NOT EXISTS purchase_order_lines (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
 product_id UUID NOT NULL REFERENCES products(id), ordered_units NUMERIC(14,3) NOT NULL CHECK(ordered_units > 0),
 received_units NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK(received_units >= 0), unit_cost NUMERIC(14,2) NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS stock_counts (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 outlet_id UUID NOT NULL REFERENCES outlets(id), status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','SUBMITTED','APPROVED','REJECTED')),
 counted_by UUID REFERENCES users(id), approved_by UUID REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS stock_count_lines (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), stock_count_id UUID NOT NULL REFERENCES stock_counts(id) ON DELETE CASCADE,
 product_id UUID NOT NULL REFERENCES products(id), expected_units NUMERIC(14,3) NOT NULL, counted_units NUMERIC(14,3) NOT NULL
);
