-- P528: authoritative checks against current outlet, organisation, licence, catalogue,
-- outlet price and retail stock. This phase still does NOT post any ledger entries.
ALTER TABLE offline_posting_intents DROP CONSTRAINT IF EXISTS offline_posting_intents_status_check;
ALTER TABLE offline_posting_intents ADD CONSTRAINT offline_posting_intents_status_check
  CHECK (status IN ('READY_FOR_POST','HELD','CANCELLED'));
CREATE TABLE IF NOT EXISTS offline_authoritative_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  posting_intent_id UUID NOT NULL REFERENCES offline_posting_intents(id) ON DELETE RESTRICT,
  event_row_id UUID NOT NULL REFERENCES offline_sync_events(id) ON DELETE RESTRICT,
  checked_by UUID NOT NULL REFERENCES users(id),
  outcome TEXT NOT NULL CHECK (outcome IN ('PASS','FAIL')),
  checks JSONB NOT NULL,
  notes TEXT NOT NULL CHECK (length(trim(notes)) BETWEEN 8 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(posting_intent_id)
);
CREATE INDEX IF NOT EXISTS idx_offline_authoritative_checks_org_created
  ON offline_authoritative_checks(organisation_id,created_at DESC);
INSERT INTO role_permissions(role_code,permission_code) VALUES
 ('PLATFORM_ADMIN','offline:authoritative-check'),('RETAIL_OWNER','offline:authoritative-check'),('RETAIL_MANAGER','offline:authoritative-check'),
 ('BAR_OWNER','offline:authoritative-check'),('BAR_MANAGER','offline:authoritative-check'),
 ('PLATFORM_ADMIN','offline:authoritative-read'),('RETAIL_OWNER','offline:authoritative-read'),('RETAIL_MANAGER','offline:authoritative-read'),
 ('BAR_OWNER','offline:authoritative-read'),('BAR_MANAGER','offline:authoritative-read')
ON CONFLICT DO NOTHING;

ALTER TABLE offline_sync_audit DROP CONSTRAINT IF EXISTS offline_sync_audit_action_check;
ALTER TABLE offline_sync_audit ADD CONSTRAINT offline_sync_audit_action_check
  CHECK (action IN ('BATCH_RECEIVED','EVENT_ACCEPTED','EVENT_DUPLICATE','EVENT_CONFLICT','RECONCILIATION_DECISION','VALIDATION_RESULT','AUTHORITATIVE_CHECK'));
