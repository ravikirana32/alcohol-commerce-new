-- P43: DevOps & infrastructure
-- Review FK assumptions and execute in staging before production.
CREATE TABLE IF NOT EXISTS deployment_records (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), environment TEXT NOT NULL, version_ref TEXT NOT NULL, status TEXT NOT NULL, deployed_at TIMESTAMPTZ, deployed_by TEXT);
CREATE TABLE IF NOT EXISTS backup_restore_drills (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), backup_ref TEXT NOT NULL, restore_environment TEXT NOT NULL, result TEXT NOT NULL, verified_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS operational_incidents (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), severity TEXT NOT NULL, summary TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), resolved_at TIMESTAMPTZ);
