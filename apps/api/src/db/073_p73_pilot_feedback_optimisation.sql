-- P73: Pilot feedback & optimisation
-- Validate in staging before applying to production.
CREATE TABLE IF NOT EXISTS pilot_feedback_items (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), outlet_ref UUID NOT NULL, category TEXT NOT NULL, severity TEXT NOT NULL DEFAULT 'normal', description TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
