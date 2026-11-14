-- P520: auditable provider/bank settlement imports and deterministic matching.
CREATE TABLE IF NOT EXISTS payment_reconciliation_batches (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 outlet_id UUID NOT NULL REFERENCES outlets(id), provider TEXT NOT NULL, statement_reference TEXT NOT NULL,
 period_start DATE, period_end DATE, status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','RECONCILED','CLOSED')),
 imported_by UUID REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(organisation_id,provider,statement_reference)
);
CREATE TABLE IF NOT EXISTS payment_reconciliation_lines (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), batch_id UUID NOT NULL REFERENCES payment_reconciliation_batches(id) ON DELETE CASCADE,
 provider_transaction_id TEXT NOT NULL, transaction_reference TEXT, method TEXT NOT NULL CHECK(method IN ('UPI','CARD','WALLET','OTHER')),
 amount NUMERIC(14,2) NOT NULL CHECK(amount > 0), transaction_at TIMESTAMPTZ,
 matched_source TEXT CHECK(matched_source IN ('RETAIL','BAR')), matched_payment_id UUID,
 status TEXT NOT NULL DEFAULT 'UNMATCHED' CHECK(status IN ('UNMATCHED','MATCHED','DUPLICATE','MISMATCH')),
 notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(batch_id,provider_transaction_id)
);
CREATE INDEX IF NOT EXISTS idx_p520_recon_batch_status ON payment_reconciliation_lines(batch_id,status);
CREATE INDEX IF NOT EXISTS idx_p520_recon_batch_ref ON payment_reconciliation_lines(transaction_reference);
INSERT INTO role_permissions(role_code,permission_code) VALUES
 ('RETAIL_OWNER','payments:reconcile'),('RETAIL_MANAGER','payments:reconcile'),
 ('BAR_OWNER','payments:reconcile'),('BAR_MANAGER','payments:reconcile') ON CONFLICT DO NOTHING;
