-- P29: Brand & distributor portal completion
-- Review FK assumptions and execute in staging before production.
CREATE TABLE IF NOT EXISTS partner_verification_reviews (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id), partner_type TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', reviewer_id UUID REFERENCES users(id), notes TEXT, reviewed_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS distributor_shipments (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), distributor_order_id UUID NOT NULL, shipment_ref TEXT, status TEXT NOT NULL DEFAULT 'pending', dispatched_at TIMESTAMPTZ, delivered_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS campaign_fulfilment (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), campaign_id UUID NOT NULL, outlet_id UUID NOT NULL REFERENCES outlets(id), status TEXT NOT NULL DEFAULT 'pending', evidence JSONB NOT NULL DEFAULT '{}'::jsonb, submitted_at TIMESTAMPTZ);
