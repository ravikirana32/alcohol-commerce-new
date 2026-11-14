-- P70: SaaS subscription management
-- Validate in staging before applying to production.
CREATE TABLE IF NOT EXISTS saas_billing_invoices (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL, invoice_no TEXT NOT NULL, amount NUMERIC(14,2) NOT NULL, currency CHAR(3) NOT NULL DEFAULT 'INR', status TEXT NOT NULL DEFAULT 'draft', issued_at TIMESTAMPTZ, UNIQUE(organisation_id,invoice_no));
