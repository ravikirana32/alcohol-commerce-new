-- P568: request-level identity for goods receipt creation.
-- A retry of the same request returns the original posted receipt; a changed
-- payload under the same key is rejected before PO quantities/balances mutate.
ALTER TABLE goods_receipts
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS request_fingerprint TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='goods_receipts_idempotency_key_shape') THEN
    ALTER TABLE goods_receipts ADD CONSTRAINT goods_receipts_idempotency_key_shape
      CHECK (idempotency_key IS NULL OR length(idempotency_key) BETWEEN 16 AND 160);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='goods_receipts_request_fingerprint_shape') THEN
    ALTER TABLE goods_receipts ADD CONSTRAINT goods_receipts_request_fingerprint_shape
      CHECK (request_fingerprint IS NULL OR request_fingerprint ~ '^[a-f0-9]{64}$');
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_goods_receipts_org_outlet_idempotency
  ON goods_receipts(organisation_id,outlet_id,idempotency_key)
  WHERE idempotency_key IS NOT NULL;
