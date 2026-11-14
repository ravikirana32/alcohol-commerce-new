-- P500.7: bind bar checkout idempotency keys to canonical request content.
ALTER TABLE bar_tickets ADD COLUMN IF NOT EXISTS request_fingerprint CHAR(64);
COMMENT ON COLUMN bar_tickets.request_fingerprint IS
  'SHA-256 fingerprint of canonical bar ticket, peg/bottle lines and tenders.';
