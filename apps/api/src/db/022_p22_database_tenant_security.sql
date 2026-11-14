-- P22: Database & tenant security
-- Review FK assumptions and execute in staging before production.
CREATE TABLE IF NOT EXISTS tenant_security_checks (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id), check_key TEXT NOT NULL, passed BOOLEAN NOT NULL DEFAULT FALSE, evidence JSONB NOT NULL DEFAULT '{}'::jsonb, checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
