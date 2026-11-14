-- P577: bank payout reconciliation evidence and chargeback lifecycle.
CREATE TABLE IF NOT EXISTS p577_bank_statement_lines (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id),
 outlet_id UUID NOT NULL REFERENCES outlets(id), bank_account_reference TEXT NOT NULL,
 statement_reference TEXT NOT NULL, transaction_date DATE NOT NULL, amount NUMERIC(14,2) NOT NULL,
 currency CHAR(3) NOT NULL DEFAULT 'INR', description TEXT, matched_settlement_batch_id UUID REFERENCES p535_settlement_batches(id),
 status TEXT NOT NULL DEFAULT 'UNMATCHED' CHECK(status IN ('UNMATCHED','MATCHED','VARIANCE','IGNORED')),
 imported_by UUID REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(organisation_id,bank_account_reference,statement_reference)
);
CREATE TABLE IF NOT EXISTS p577_chargeback_cases (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id),
 outlet_id UUID NOT NULL REFERENCES outlets(id), tender_allocation_id UUID REFERENCES p535_tender_allocations(id),
 provider_case_id TEXT NOT NULL, amount NUMERIC(14,2) NOT NULL CHECK(amount>0),
 reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','EVIDENCE_SUBMITTED','WON','LOST','CLOSED')),
 evidence_reference TEXT, due_at TIMESTAMPTZ, resolved_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(organisation_id,provider_case_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_p577_bank_line_settlement_batch
 ON p577_bank_statement_lines(matched_settlement_batch_id) WHERE matched_settlement_batch_id IS NOT NULL;
