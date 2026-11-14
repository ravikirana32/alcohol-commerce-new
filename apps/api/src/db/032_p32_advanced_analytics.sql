-- P32: Advanced analytics
-- Review FK assumptions and execute in staging before production.
CREATE TABLE IF NOT EXISTS analytics_metric_snapshots (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id), outlet_id UUID REFERENCES outlets(id), metric_key TEXT NOT NULL, metric_value NUMERIC(18,4) NOT NULL, dimensions JSONB NOT NULL DEFAULT '{}'::jsonb, captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS report_delivery_schedules (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id), report_key TEXT NOT NULL, cadence TEXT NOT NULL, destination TEXT NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE);
