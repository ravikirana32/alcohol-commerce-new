-- P39: AI-assisted operations (opt-in)
-- Review FK assumptions and execute in staging before production.
CREATE TABLE IF NOT EXISTS ai_operation_jobs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id), job_type TEXT NOT NULL, input_ref TEXT, status TEXT NOT NULL DEFAULT 'queued', model_ref TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS ai_recommendations (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), job_id UUID NOT NULL REFERENCES ai_operation_jobs(id), recommendation JSONB NOT NULL, reviewed_by UUID REFERENCES users(id), review_status TEXT NOT NULL DEFAULT 'pending', reviewed_at TIMESTAMPTZ);
