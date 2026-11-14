-- P72: Pilot deployment
-- Validate in staging before applying to production.
CREATE TABLE IF NOT EXISTS pilot_deployment_records (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), outlet_ref UUID NOT NULL, cohort TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'planned', migrated_at TIMESTAMPTZ, trained_at TIMESTAMPTZ, launched_at TIMESTAMPTZ);
