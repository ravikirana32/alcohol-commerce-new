-- P530: transactional, idempotent offline retail sale posting.
-- Bar checkout remains fail-closed until P531 measure-aware bottle depletion exists.
ALTER TABLE offline_sync_events DROP CONSTRAINT IF EXISTS offline_sync_events_status_check;
ALTER TABLE offline_sync_events ADD CONSTRAINT offline_sync_events_status_check CHECK (status IN ('REVIEW_REQUIRED','DUPLICATE','CONFLICT','REJECTED','APPROVED_NO_POST','VALIDATION_FAILED','READY_FOR_POST','POSTED'));
ALTER TABLE offline_posting_intents DROP CONSTRAINT IF EXISTS offline_posting_intents_status_check;
ALTER TABLE offline_posting_intents ADD CONSTRAINT offline_posting_intents_status_check
  CHECK (status IN ('READY_FOR_POST','HELD','CANCELLED','AUTHORIZED_TO_POST','POSTED'));
CREATE TABLE IF NOT EXISTS offline_posting_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  posting_intent_id UUID NOT NULL UNIQUE REFERENCES offline_posting_intents(id) ON DELETE RESTRICT,
  event_row_id UUID NOT NULL UNIQUE REFERENCES offline_sync_events(id) ON DELETE RESTRICT,
  sale_id UUID REFERENCES retail_sales(id) ON DELETE RESTRICT,
  outcome TEXT NOT NULL CHECK (outcome IN ('POSTED','BLOCKED')),
  reason_code TEXT,
  payload_hash TEXT NOT NULL CHECK (payload_hash ~ '^[a-f0-9]{64}$'),
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organisation_id,outlet_id,posting_intent_id)
);
CREATE INDEX IF NOT EXISTS idx_offline_posting_executions_org_time
  ON offline_posting_executions(organisation_id,executed_at DESC);
ALTER TABLE offline_sync_audit DROP CONSTRAINT IF EXISTS offline_sync_audit_action_check;
ALTER TABLE offline_sync_audit ADD CONSTRAINT offline_sync_audit_action_check CHECK (action IN
 ('BATCH_RECEIVED','EVENT_ACCEPTED','EVENT_DUPLICATE','EVENT_CONFLICT','RECONCILIATION_DECISION','VALIDATION_RESULT','AUTHORITATIVE_CHECK','POSTING_APPROVAL','LEDGER_POSTED','LEDGER_POST_BLOCKED'));
INSERT INTO role_permissions(role_code,permission_code) VALUES
 ('PLATFORM_ADMIN','offline:ledger-post'),('RETAIL_OWNER','offline:ledger-post'),('RETAIL_MANAGER','offline:ledger-post'),
 ('PLATFORM_ADMIN','offline:ledger-read'),('RETAIL_OWNER','offline:ledger-read'),('RETAIL_MANAGER','offline:ledger-read'),
 ('BAR_OWNER','offline:ledger-read'),('BAR_MANAGER','offline:ledger-read') ON CONFLICT DO NOTHING;
