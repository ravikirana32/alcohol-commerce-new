-- P578: financial statement controls and period close evidence.
CREATE TABLE IF NOT EXISTS p578_period_close_checks (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id),
 period_id UUID NOT NULL REFERENCES p536_accounting_periods(id), checked_by UUID NOT NULL REFERENCES users(id),
 trial_balance_debit NUMERIC(14,2) NOT NULL, trial_balance_credit NUMERIC(14,2) NOT NULL,
 unbalanced_journal_count INTEGER NOT NULL DEFAULT 0, unresolved_payment_exception_count INTEGER NOT NULL DEFAULT 0,
 unresolved_cost_exception_count INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL CHECK(status IN ('PASS','BLOCKED')),
 notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_p578_period_close_checks ON p578_period_close_checks(organisation_id,period_id,created_at DESC);

ALTER TABLE finance_accounts ADD COLUMN IF NOT EXISTS is_postable BOOLEAN NOT NULL DEFAULT TRUE;
CREATE INDEX IF NOT EXISTS idx_finance_accounts_postable ON finance_accounts(organisation_id,is_active,is_postable,account_type);
