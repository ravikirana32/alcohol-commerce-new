-- P51: End-to-end business workflows
-- Validate in staging before applying to production.
CREATE TABLE IF NOT EXISTS workflow_verification_runs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workflow_key TEXT NOT NULL, environment TEXT NOT NULL, status TEXT NOT NULL, evidence JSONB NOT NULL DEFAULT '{}'::jsonb, executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
