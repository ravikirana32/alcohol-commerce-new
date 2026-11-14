-- P75: Enterprise expansion
-- Validate in staging before applying to production.
CREATE TABLE IF NOT EXISTS enterprise_jurisdiction_profiles (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL, jurisdiction_code TEXT NOT NULL, configuration JSONB NOT NULL DEFAULT '{}'::jsonb, status TEXT NOT NULL DEFAULT 'draft', UNIQUE(organisation_id,jurisdiction_code));
