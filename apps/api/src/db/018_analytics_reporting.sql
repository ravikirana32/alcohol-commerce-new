CREATE TABLE IF NOT EXISTS report_definitions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id),
 report_key TEXT NOT NULL, configuration JSONB NOT NULL DEFAULT '{}', enabled BOOLEAN NOT NULL DEFAULT TRUE,
 UNIQUE(organisation_id,report_key)
);
CREATE TABLE IF NOT EXISTS report_runs (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id),
 report_key TEXT NOT NULL, parameters JSONB NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'QUEUED',
 result_uri TEXT, requested_by UUID REFERENCES users(id), created_at TIMESTAMPTZ DEFAULT NOW(), completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_report_runs_org_date ON report_runs(organisation_id,created_at DESC);
