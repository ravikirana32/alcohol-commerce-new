-- P52: Transaction integrity
-- Validate in staging before applying to production.
CREATE TABLE IF NOT EXISTS transaction_integrity_checks (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), transaction_type TEXT NOT NULL, idempotency_key TEXT NOT NULL, payload_hash TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'received', result_ref TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(transaction_type,idempotency_key));
