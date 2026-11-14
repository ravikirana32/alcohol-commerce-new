-- P63: Accounting integration completion
-- Validate in staging before applying to production.
CREATE TABLE IF NOT EXISTS accounting_export_jobs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL, provider TEXT NOT NULL, period_start DATE NOT NULL, period_end DATE NOT NULL, status TEXT NOT NULL DEFAULT 'queued', external_ref TEXT);
