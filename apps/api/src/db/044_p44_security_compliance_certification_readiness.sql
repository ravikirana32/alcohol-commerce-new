-- P44: Security & compliance certification readiness
-- Review FK assumptions and execute in staging before production.
CREATE TABLE IF NOT EXISTS compliance_controls (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), control_key TEXT NOT NULL UNIQUE, domain TEXT NOT NULL, description TEXT NOT NULL, owner TEXT, status TEXT NOT NULL DEFAULT 'not_assessed');
CREATE TABLE IF NOT EXISTS compliance_findings (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), control_id UUID NOT NULL REFERENCES compliance_controls(id), severity TEXT NOT NULL, finding TEXT NOT NULL, remediation TEXT, status TEXT NOT NULL DEFAULT 'open');
CREATE TABLE IF NOT EXISTS compliance_evidence (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), control_id UUID NOT NULL REFERENCES compliance_controls(id), evidence_uri TEXT NOT NULL, evidence_hash TEXT, submitted_by UUID REFERENCES users(id), submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
