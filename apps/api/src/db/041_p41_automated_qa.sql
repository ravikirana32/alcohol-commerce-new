-- P41: Automated QA
-- Review FK assumptions and execute in staging before production.
CREATE TABLE IF NOT EXISTS qa_test_runs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), suite_key TEXT NOT NULL, commit_ref TEXT, status TEXT NOT NULL, started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), completed_at TIMESTAMPTZ, summary JSONB NOT NULL DEFAULT '{}'::jsonb);
CREATE TABLE IF NOT EXISTS release_gate_results (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), release_ref TEXT NOT NULL, gate_key TEXT NOT NULL, passed BOOLEAN NOT NULL, evidence_uri TEXT, evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
