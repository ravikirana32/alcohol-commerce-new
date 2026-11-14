-- P529: independent second approval for offline posting intents.
-- AUTHORIZED_TO_POST is an authorization state only: this migration does not post ledgers.
ALTER TABLE offline_posting_intents DROP CONSTRAINT IF EXISTS offline_posting_intents_status_check;
ALTER TABLE offline_posting_intents ADD CONSTRAINT offline_posting_intents_status_check
  CHECK (status IN ('READY_FOR_POST','HELD','CANCELLED','AUTHORIZED_TO_POST'));
CREATE TABLE IF NOT EXISTS offline_posting_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  posting_intent_id UUID NOT NULL REFERENCES offline_posting_intents(id) ON DELETE RESTRICT,
  event_row_id UUID NOT NULL REFERENCES offline_sync_events(id) ON DELETE RESTRICT,
  approved_by UUID NOT NULL REFERENCES users(id),
  outcome TEXT NOT NULL CHECK (outcome IN ('APPROVE','REJECT')),
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 8 AND 500),
  validation_hash TEXT NOT NULL CHECK (validation_hash ~ '^[a-f0-9]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(posting_intent_id)
);
CREATE INDEX IF NOT EXISTS idx_offline_posting_approvals_org_created
  ON offline_posting_approvals(organisation_id,created_at DESC);
ALTER TABLE offline_sync_audit DROP CONSTRAINT IF EXISTS offline_sync_audit_action_check;
ALTER TABLE offline_sync_audit ADD CONSTRAINT offline_sync_audit_action_check
  CHECK (action IN ('BATCH_RECEIVED','EVENT_ACCEPTED','EVENT_DUPLICATE','EVENT_CONFLICT','RECONCILIATION_DECISION','VALIDATION_RESULT','AUTHORITATIVE_CHECK','POSTING_APPROVAL'));
INSERT INTO role_permissions(role_code,permission_code) VALUES
 ('PLATFORM_ADMIN','offline:posting-approve'),('RETAIL_OWNER','offline:posting-approve'),
 ('BAR_OWNER','offline:posting-approve'),('RETAIL_MANAGER','offline:posting-approve'),('BAR_MANAGER','offline:posting-approve'),
 ('PLATFORM_ADMIN','offline:posting-approval-read'),('RETAIL_OWNER','offline:posting-approval-read'),
 ('RETAIL_MANAGER','offline:posting-approval-read'),('BAR_OWNER','offline:posting-approval-read'),('BAR_MANAGER','offline:posting-approval-read')
ON CONFLICT DO NOTHING;
