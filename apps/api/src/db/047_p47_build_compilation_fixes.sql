-- P47: Build & compilation fixes
-- Validate in staging before applying to production.
CREATE TABLE IF NOT EXISTS build_verification_runs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), component TEXT NOT NULL, command TEXT NOT NULL, status TEXT NOT NULL, output_hash TEXT, executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
