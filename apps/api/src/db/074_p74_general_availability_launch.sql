-- P74: General availability launch
-- Validate in staging before applying to production.
CREATE TABLE IF NOT EXISTS ga_release_approvals (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), release_ref TEXT NOT NULL, gate_key TEXT NOT NULL, approved BOOLEAN NOT NULL DEFAULT FALSE, approver TEXT, evidence_uri TEXT, approved_at TIMESTAMPTZ);
