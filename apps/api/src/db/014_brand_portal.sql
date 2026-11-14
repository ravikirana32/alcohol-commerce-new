CREATE TABLE IF NOT EXISTS brand_profiles (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL UNIQUE REFERENCES organisations(id),
 brand_name TEXT NOT NULL, description TEXT, website TEXT, logo_uri TEXT, verification_status TEXT NOT NULL DEFAULT 'PENDING',
 created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS brand_campaigns (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id),
 name TEXT NOT NULL, objective TEXT NOT NULL, starts_at TIMESTAMPTZ, ends_at TIMESTAMPTZ,
 status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','SUBMITTED','APPROVED','ACTIVE','PAUSED','COMPLETED','REJECTED')),
 created_by UUID REFERENCES users(id), created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS brand_campaign_outlets (
 campaign_id UUID NOT NULL REFERENCES brand_campaigns(id) ON DELETE CASCADE, outlet_id UUID NOT NULL REFERENCES outlets(id),
 PRIMARY KEY(campaign_id,outlet_id)
);
CREATE TABLE IF NOT EXISTS brand_assets (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id),
 campaign_id UUID REFERENCES brand_campaigns(id) ON DELETE CASCADE, asset_uri TEXT NOT NULL, asset_type TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO role_permissions(role_code,permission_code)
SELECT role_code,permission_code FROM (VALUES
 ('PLATFORM_ADMIN','brand:manage'),('PLATFORM_ADMIN','brand:read')
) AS p(role_code,permission_code) ON CONFLICT DO NOTHING;
