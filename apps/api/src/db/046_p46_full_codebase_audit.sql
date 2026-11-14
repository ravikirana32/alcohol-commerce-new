-- P46: Full codebase audit
-- Validate in staging before applying to production.
CREATE TABLE IF NOT EXISTS code_audit_findings (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), area TEXT NOT NULL, severity TEXT NOT NULL, finding TEXT NOT NULL, owner TEXT, status TEXT NOT NULL DEFAULT 'open', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
