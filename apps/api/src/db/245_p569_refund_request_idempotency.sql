-- P569: request-level idempotency for retail and bar refunds.
-- Nullable columns preserve compatibility with historical refund records.
ALTER TABLE retail_refunds ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE retail_refunds ADD COLUMN IF NOT EXISTS request_fingerprint CHAR(64);
ALTER TABLE bar_refunds ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE bar_refunds ADD COLUMN IF NOT EXISTS request_fingerprint CHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS uq_retail_refunds_org_outlet_idempotency
  ON retail_refunds(organisation_id,outlet_id,idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_bar_refunds_org_outlet_idempotency
  ON bar_refunds(organisation_id,outlet_id,idempotency_key)
  WHERE idempotency_key IS NOT NULL;
