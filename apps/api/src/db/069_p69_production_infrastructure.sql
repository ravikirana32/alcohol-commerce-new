-- P69: Production infrastructure
-- Validate in staging before applying to production.
CREATE TABLE IF NOT EXISTS infrastructure_drill_records (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), drill_type TEXT NOT NULL, environment TEXT NOT NULL, outcome TEXT NOT NULL, evidence_uri TEXT, completed_at TIMESTAMPTZ);
