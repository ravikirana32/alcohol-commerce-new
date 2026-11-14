-- P531: measure-aware offline bar posting, payment evidence state and bottle reservations.
ALTER TABLE offline_posting_executions
  ADD COLUMN IF NOT EXISTS bar_ticket_id UUID REFERENCES bar_tickets(id) ON DELETE RESTRICT;
DO $$ BEGIN
  ALTER TABLE offline_posting_executions
    ADD CONSTRAINT ck_offline_posting_execution_single_source
    CHECK (outcome <> 'POSTED' OR ((sale_id IS NOT NULL) <> (bar_ticket_id IS NOT NULL)));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE bar_payments ADD COLUMN IF NOT EXISTS settlement_status TEXT NOT NULL DEFAULT 'UNKNOWN';
DO $$ BEGIN
  ALTER TABLE bar_payments ADD CONSTRAINT ck_bar_payment_settlement_status
    CHECK (settlement_status IN ('UNKNOWN','RECORDED_OFFLINE','PENDING','SETTLED','FAILED','REFUNDED'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS bar_bottle_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  open_bottle_id UUID NOT NULL REFERENCES open_bottles(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  reserved_ml INTEGER NOT NULL CHECK (reserved_ml > 0),
  consumed_ml INTEGER NOT NULL DEFAULT 0 CHECK (consumed_ml >= 0 AND consumed_ml <= reserved_ml),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','CONSUMED','RELEASED','EXPIRED')),
  expires_at TIMESTAMPTZ NOT NULL,
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 3 AND 500),
  created_by UUID REFERENCES users(id),
  released_by UUID REFERENCES users(id),
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS idx_bar_bottle_reservations_active
  ON bar_bottle_reservations(organisation_id,outlet_id,open_bottle_id,expires_at)
  WHERE status='ACTIVE';
CREATE INDEX IF NOT EXISTS idx_offline_posting_execution_bar_ticket
  ON offline_posting_executions(organisation_id,outlet_id,bar_ticket_id)
  WHERE bar_ticket_id IS NOT NULL;
COMMENT ON COLUMN bar_payments.settlement_status IS
  'P531 distinguishes offline tender evidence from confirmed settlement; provider reconciliation is implemented in P535.';

ALTER TABLE peg_transactions DROP CONSTRAINT IF EXISTS peg_transactions_transaction_type_check;
ALTER TABLE peg_transactions ADD CONSTRAINT peg_transactions_transaction_type_check
  CHECK (transaction_type IN ('SALE','WASTAGE','COMPLIMENTARY','ADJUSTMENT','BREAKAGE'));
