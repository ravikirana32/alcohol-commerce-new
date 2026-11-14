-- P71: White-label platform
-- Validate in staging before applying to production.
CREATE TABLE IF NOT EXISTS tenant_branding_settings (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL UNIQUE, brand_name TEXT, logo_uri TEXT, theme JSONB NOT NULL DEFAULT '{}'::jsonb, custom_domain TEXT);
