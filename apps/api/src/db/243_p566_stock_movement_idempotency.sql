-- P566: retry-safe stock movement identity.
-- A key identifies one source event line, not an entire document. This preserves
-- legitimate split receipts/transfers and repeated products on separate lines.
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS request_fingerprint TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_movements_idempotency_key_shape'
  ) THEN
    ALTER TABLE stock_movements
      ADD CONSTRAINT stock_movements_idempotency_key_shape
      CHECK (idempotency_key IS NULL OR length(idempotency_key) BETWEEN 16 AND 160);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_movements_fingerprint_shape'
  ) THEN
    ALTER TABLE stock_movements
      ADD CONSTRAINT stock_movements_fingerprint_shape
      CHECK (request_fingerprint IS NULL OR request_fingerprint ~ '^[a-f0-9]{64}$');
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_stock_movements_org_outlet_idempotency
  ON stock_movements(organisation_id, outlet_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stock_movements_reference_scope
  ON stock_movements(organisation_id, outlet_id, reference_type, reference_id)
  WHERE reference_id IS NOT NULL;
