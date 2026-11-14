-- P500.2: persist the canonical retail checkout request fingerprint for safe idempotent retries.
-- Existing rows remain nullable and are verified against their stored lines/payments on first replay.
ALTER TABLE retail_sales
  ADD COLUMN IF NOT EXISTS request_fingerprint CHAR(64);

COMMENT ON COLUMN retail_sales.request_fingerprint IS
  'SHA-256 fingerprint of canonical checkout request; prevents reusing an idempotency key for a different sale.';
