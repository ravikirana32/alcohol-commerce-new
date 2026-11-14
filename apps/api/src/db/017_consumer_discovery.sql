CREATE TABLE IF NOT EXISTS consumer_discovery_settings (
 organisation_id UUID PRIMARY KEY REFERENCES organisations(id), discovery_enabled BOOLEAN NOT NULL DEFAULT FALSE,
 legal_review_reference TEXT, approved_at TIMESTAMPTZ, updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS consumer_public_listings (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id),
 outlet_id UUID NOT NULL REFERENCES outlets(id), public_name TEXT NOT NULL, public_address JSONB NOT NULL DEFAULT '{}',
 public_hours JSONB NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'HIDDEN' CHECK(status IN ('HIDDEN','PUBLISHED','WITHDRAWN')),
 approved_by UUID REFERENCES users(id), approved_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS consumer_listing_audit (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), listing_id UUID NOT NULL REFERENCES consumer_public_listings(id),
 action TEXT NOT NULL, actor_id UUID REFERENCES users(id), notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
);
