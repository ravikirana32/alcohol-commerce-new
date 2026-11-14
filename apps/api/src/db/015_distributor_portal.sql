CREATE TABLE IF NOT EXISTS distributor_profiles (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL UNIQUE REFERENCES organisations(id),
 territory JSONB NOT NULL DEFAULT '{}', verification_status TEXT NOT NULL DEFAULT 'PENDING', contact JSONB NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS distributor_outlet_assignments (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), distributor_org_id UUID NOT NULL REFERENCES organisations(id),
 outlet_id UUID NOT NULL REFERENCES outlets(id), territory_code TEXT, status TEXT NOT NULL DEFAULT 'ACTIVE',
 UNIQUE(distributor_org_id,outlet_id)
);
CREATE TABLE IF NOT EXISTS distributor_orders (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id),
 outlet_id UUID NOT NULL REFERENCES outlets(id), order_number TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'DRAFT'
 CHECK(status IN ('DRAFT','SUBMITTED','ACCEPTED','REJECTED','FULFILLED','CANCELLED')),
 requested_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(organisation_id,order_number)
);
CREATE TABLE IF NOT EXISTS distributor_order_lines (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_id UUID NOT NULL REFERENCES distributor_orders(id) ON DELETE CASCADE,
 product_id UUID NOT NULL REFERENCES products(id), quantity NUMERIC(14,3) NOT NULL CHECK(quantity>0), quoted_price NUMERIC(14,2)
);
