-- P25: Retail POS completion
-- Review FK assumptions and execute in staging before production.
CREATE TABLE IF NOT EXISTS retail_tenders (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), sale_id UUID NOT NULL, tender_type TEXT NOT NULL, amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0), reference TEXT, status TEXT NOT NULL DEFAULT 'captured', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS retail_returns (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id), outlet_id UUID NOT NULL REFERENCES outlets(id), original_sale_id UUID NOT NULL, return_no TEXT NOT NULL, reason TEXT NOT NULL, amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0), status TEXT NOT NULL DEFAULT 'pending', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(outlet_id, return_no));
CREATE TABLE IF NOT EXISTS pos_receipt_sequences (outlet_id UUID PRIMARY KEY REFERENCES outlets(id), next_value BIGINT NOT NULL DEFAULT 1);
