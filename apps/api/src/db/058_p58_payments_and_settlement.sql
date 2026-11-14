-- P58: Payments and settlement
-- Validate in staging before applying to production.
CREATE TABLE IF NOT EXISTS payment_provider_events (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL, provider TEXT NOT NULL, provider_event_id TEXT NOT NULL, event_type TEXT NOT NULL, payload_hash TEXT NOT NULL, processed_at TIMESTAMPTZ, UNIQUE(provider,provider_event_id));
