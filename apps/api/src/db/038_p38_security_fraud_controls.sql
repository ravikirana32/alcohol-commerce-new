-- P38: Security & fraud controls
-- Review FK assumptions and execute in staging before production.
CREATE TABLE IF NOT EXISTS risk_alerts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id), outlet_id UUID REFERENCES outlets(id), risk_key TEXT NOT NULL, severity TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')), score NUMERIC(6,2), context JSONB NOT NULL DEFAULT '{}'::jsonb, status TEXT NOT NULL DEFAULT 'open', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS risk_investigations (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), alert_id UUID NOT NULL REFERENCES risk_alerts(id), assigned_to UUID REFERENCES users(id), outcome TEXT, closed_at TIMESTAMPTZ);
