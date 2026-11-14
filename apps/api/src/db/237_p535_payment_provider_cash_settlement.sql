-- P535: provider webhook evidence, tender allocation, cash count and settlement lifecycle.
CREATE TABLE IF NOT EXISTS p535_provider_events (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
 provider TEXT NOT NULL, provider_event_id TEXT NOT NULL, event_type TEXT NOT NULL,
 payload JSONB NOT NULL, payload_sha256 CHAR(64) NOT NULL, signature_verified BOOLEAN NOT NULL DEFAULT FALSE,
 processing_status TEXT NOT NULL DEFAULT 'RECEIVED' CHECK(processing_status IN ('RECEIVED','REVIEW_REQUIRED','APPLIED','REJECTED')),
 received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(provider,provider_event_id)
);
CREATE INDEX IF NOT EXISTS idx_p535_provider_events_status ON p535_provider_events(processing_status,received_at);
CREATE TABLE IF NOT EXISTS p535_tender_allocations (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 outlet_id UUID NOT NULL REFERENCES outlets(id), source_type TEXT NOT NULL CHECK(source_type IN ('RETAIL','BAR')),
 source_id UUID NOT NULL, tender_method TEXT NOT NULL CHECK(tender_method IN ('CASH','UPI','CARD','WALLET','OTHER')),
 amount NUMERIC(14,2) NOT NULL CHECK(amount>0), provider TEXT, provider_transaction_id TEXT,
 lifecycle_status TEXT NOT NULL DEFAULT 'RECORDED' CHECK(lifecycle_status IN ('RECORDED','RECORDED_OFFLINE','PENDING','CONFIRMED','FAILED','REFUNDED','DISPUTED')),
 created_by UUID REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_p535_provider_tender ON p535_tender_allocations(organisation_id,provider,provider_transaction_id) WHERE provider IS NOT NULL AND provider_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_p535_tender_source ON p535_tender_allocations(organisation_id,source_type,source_id);
CREATE TABLE IF NOT EXISTS p535_cash_counts (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 outlet_id UUID NOT NULL REFERENCES outlets(id), shift_id UUID NOT NULL REFERENCES outlet_shifts(id),
 denomination NUMERIC(10,2) NOT NULL CHECK(denomination>0), quantity INTEGER NOT NULL CHECK(quantity>=0),
 counted_by UUID REFERENCES users(id), counted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(shift_id,denomination,counted_by)
);
CREATE TABLE IF NOT EXISTS p535_settlement_batches (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 outlet_id UUID NOT NULL REFERENCES outlets(id), provider TEXT NOT NULL, settlement_reference TEXT NOT NULL,
 currency CHAR(3) NOT NULL DEFAULT 'INR', gross_amount NUMERIC(14,2) NOT NULL CHECK(gross_amount>=0),
 fee_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK(fee_amount>=0), net_amount NUMERIC(14,2) NOT NULL CHECK(net_amount>=0),
 payout_reference TEXT, payout_date DATE, status TEXT NOT NULL DEFAULT 'IMPORTED' CHECK(status IN ('IMPORTED','MATCHED','PARTIAL','EXCEPTION','BANK_CONFIRMED','CLOSED')),
 imported_by UUID REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(organisation_id,provider,settlement_reference), CHECK(ABS(gross_amount-fee_amount-net_amount)<0.02)
);
CREATE TABLE IF NOT EXISTS p535_settlement_items (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), batch_id UUID NOT NULL REFERENCES p535_settlement_batches(id) ON DELETE CASCADE,
 provider_transaction_id TEXT NOT NULL, gross_amount NUMERIC(14,2) NOT NULL CHECK(gross_amount>0), fee_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK(fee_amount>=0),
 matched_tender_id UUID REFERENCES p535_tender_allocations(id), status TEXT NOT NULL DEFAULT 'UNMATCHED' CHECK(status IN ('UNMATCHED','MATCHED','DUPLICATE','AMOUNT_MISMATCH','REFUNDED','DISPUTED')),
 UNIQUE(batch_id,provider_transaction_id)
);
CREATE TABLE IF NOT EXISTS p535_payment_exceptions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 outlet_id UUID REFERENCES outlets(id), exception_type TEXT NOT NULL, source_type TEXT NOT NULL, source_id UUID,
 severity TEXT NOT NULL DEFAULT 'MEDIUM' CHECK(severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
 status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','UNDER_REVIEW','RESOLVED','REJECTED')),
 reason TEXT NOT NULL, resolution TEXT, created_by UUID REFERENCES users(id), resolved_by UUID REFERENCES users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), resolved_at TIMESTAMPTZ,
 CHECK((status IN ('RESOLVED','REJECTED') AND resolution IS NOT NULL AND resolved_by IS NOT NULL) OR status NOT IN ('RESOLVED','REJECTED'))
);
CREATE INDEX IF NOT EXISTS idx_p535_exceptions_open ON p535_payment_exceptions(organisation_id,status,created_at DESC);
INSERT INTO role_permissions(role_code,permission_code) VALUES
 ('RETAIL_OWNER','payments:operate'),('RETAIL_MANAGER','payments:operate'),('BAR_OWNER','payments:operate'),('BAR_MANAGER','payments:operate'),
 ('RETAIL_OWNER','payments:exceptions:resolve'),('BAR_OWNER','payments:exceptions:resolve') ON CONFLICT DO NOTHING;
