-- P33: CRM & loyalty completion
-- Review FK assumptions and execute in staging before production.
CREATE TABLE IF NOT EXISTS loyalty_redemptions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), loyalty_account_id UUID NOT NULL, points INTEGER NOT NULL CHECK (points > 0), reference TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS customer_segments (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id), name TEXT NOT NULL, criteria JSONB NOT NULL DEFAULT '{}'::jsonb, active BOOLEAN NOT NULL DEFAULT TRUE);
CREATE TABLE IF NOT EXISTS customer_communication_preferences (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), customer_id UUID NOT NULL, channel TEXT NOT NULL, allowed BOOLEAN NOT NULL DEFAULT FALSE, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(customer_id, channel));
