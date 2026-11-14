-- P53: Advanced retail billing
-- Validate in staging before applying to production.
CREATE TABLE IF NOT EXISTS retail_receipt_records (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), outlet_id UUID NOT NULL, sale_ref UUID NOT NULL, receipt_no TEXT NOT NULL, payload JSONB NOT NULL DEFAULT '{}'::jsonb, printed_at TIMESTAMPTZ, UNIQUE(outlet_id,receipt_no));
