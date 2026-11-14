-- P64: Multi-outlet enterprise operations
-- Validate in staging before applying to production.
CREATE TABLE IF NOT EXISTS enterprise_outlet_policies (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL, policy_key TEXT NOT NULL, policy_value JSONB NOT NULL, effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(organisation_id,policy_key));
