-- P56: Stock intelligence
-- Validate in staging before applying to production.
CREATE TABLE IF NOT EXISTS inventory_alert_rules (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL, outlet_id UUID, product_ref UUID NOT NULL, rule_key TEXT NOT NULL, threshold NUMERIC(14,3), active BOOLEAN NOT NULL DEFAULT TRUE);
