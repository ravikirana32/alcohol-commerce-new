-- P54: Advanced peg management
-- Validate in staging before applying to production.
CREATE TABLE IF NOT EXISTS peg_yield_reconciliations (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), outlet_id UUID NOT NULL, bottle_ref UUID NOT NULL, opening_ml NUMERIC(12,3) NOT NULL, sold_ml NUMERIC(12,3) NOT NULL DEFAULT 0, wastage_ml NUMERIC(12,3) NOT NULL DEFAULT 0, closing_ml NUMERIC(12,3), variance_ml NUMERIC(12,3), reconciled_at TIMESTAMPTZ);
