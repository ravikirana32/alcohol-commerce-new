-- P209: support deterministic bar idempotency and bottle ledger reads.
CREATE INDEX IF NOT EXISTS idx_open_bottles_checkout_lock
  ON open_bottles(organisation_id, outlet_id, product_id, status);
CREATE INDEX IF NOT EXISTS idx_peg_transactions_reference
  ON peg_transactions(reference_id, transaction_type);
