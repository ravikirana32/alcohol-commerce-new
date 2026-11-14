-- P34: Consumer experience legal gate
-- Review FK assumptions and execute in staging before production.
CREATE TABLE IF NOT EXISTS consumer_eligibility_checks (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), jurisdiction_code TEXT NOT NULL, outcome TEXT NOT NULL CHECK (outcome IN ('eligible','ineligible','review')), method TEXT NOT NULL, evidence_hash TEXT, checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS consumer_publication_approvals (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), listing_id UUID NOT NULL, jurisdiction_code TEXT NOT NULL, approved BOOLEAN NOT NULL DEFAULT FALSE, legal_reference TEXT NOT NULL, reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS privacy_requests (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), requester_ref_hash TEXT NOT NULL, request_type TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'received', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
