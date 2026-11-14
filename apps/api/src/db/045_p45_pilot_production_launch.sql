-- P45: Pilot & production launch
-- Review FK assumptions and execute in staging before production.
CREATE TABLE IF NOT EXISTS pilot_outlets (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), outlet_id UUID NOT NULL REFERENCES outlets(id), cohort TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'planned', go_live_at TIMESTAMPTZ, UNIQUE(outlet_id, cohort));
CREATE TABLE IF NOT EXISTS data_migration_batches (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id), source_system TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'prepared', row_counts JSONB NOT NULL DEFAULT '{}'::jsonb, validated_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS training_completions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), outlet_id UUID NOT NULL REFERENCES outlets(id), user_id UUID NOT NULL REFERENCES users(id), module_key TEXT NOT NULL, completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS launch_approvals (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), outlet_id UUID NOT NULL REFERENCES outlets(id), gate_key TEXT NOT NULL, approved BOOLEAN NOT NULL DEFAULT FALSE, approver TEXT, evidence_uri TEXT, approved_at TIMESTAMPTZ);
