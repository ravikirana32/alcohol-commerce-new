-- P48: Database validation
-- Validate in staging before applying to production.
CREATE TABLE IF NOT EXISTS migration_verification_runs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), database_fingerprint TEXT NOT NULL, migration_name TEXT NOT NULL, status TEXT NOT NULL, details JSONB NOT NULL DEFAULT '{}'::jsonb, verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
