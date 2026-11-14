-- P59: Brand campaign execution
-- Validate in staging before applying to production.
CREATE TABLE IF NOT EXISTS brand_campaign_executions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), campaign_ref UUID NOT NULL, outlet_ref UUID NOT NULL, status TEXT NOT NULL DEFAULT 'planned', evidence JSONB NOT NULL DEFAULT '{}'::jsonb, completed_at TIMESTAMPTZ);
