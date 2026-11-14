-- P60: Distributor management
-- Validate in staging before applying to production.
CREATE TABLE IF NOT EXISTS distributor_fulfilment_events (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_ref UUID NOT NULL, event_type TEXT NOT NULL, reference TEXT, payload JSONB NOT NULL DEFAULT '{}'::jsonb, occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
