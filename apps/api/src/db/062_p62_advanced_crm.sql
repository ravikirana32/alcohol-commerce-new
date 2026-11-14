-- P62: Advanced CRM
-- Validate in staging before applying to production.
CREATE TABLE IF NOT EXISTS customer_memberships (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL, customer_ref UUID NOT NULL, tier_code TEXT NOT NULL, starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), ends_at TIMESTAMPTZ, status TEXT NOT NULL DEFAULT 'active');
