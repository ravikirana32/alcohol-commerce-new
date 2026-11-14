-- P66: Security hardening
-- Validate in staging before applying to production.
CREATE TABLE IF NOT EXISTS security_review_findings (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), finding_key TEXT NOT NULL, severity TEXT NOT NULL, description TEXT NOT NULL, remediation TEXT, status TEXT NOT NULL DEFAULT 'open', reviewed_at TIMESTAMPTZ);
