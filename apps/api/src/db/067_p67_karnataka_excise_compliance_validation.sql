-- P67: Karnataka excise compliance validation
-- Validate in staging before applying to production.
CREATE TABLE IF NOT EXISTS excise_rule_review_evidence (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), jurisdiction_code TEXT NOT NULL, licence_activity TEXT NOT NULL, source_reference TEXT NOT NULL, reviewed_by TEXT, review_status TEXT NOT NULL DEFAULT 'pending', reviewed_at TIMESTAMPTZ);
