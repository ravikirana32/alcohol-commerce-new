-- P527: validation evidence and posting intents. This phase does NOT mutate sales,
-- payments, inventory or accounting ledgers; intents remain READY_FOR_POST.
ALTER TABLE offline_sync_events DROP CONSTRAINT IF EXISTS offline_sync_events_status_check;
ALTER TABLE offline_sync_events ADD CONSTRAINT offline_sync_events_status_check
  CHECK (status IN ('REVIEW_REQUIRED','DUPLICATE','CONFLICT','REJECTED','APPROVED_NO_POST','VALIDATION_FAILED','READY_FOR_POST'));
CREATE TABLE IF NOT EXISTS offline_event_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  event_row_id UUID NOT NULL REFERENCES offline_sync_events(id) ON DELETE CASCADE,
  validator_user_id UUID NOT NULL REFERENCES users(id),
  outcome TEXT NOT NULL CHECK (outcome IN ('PASS','FAIL')),
  checks JSONB NOT NULL,
  notes TEXT NOT NULL CHECK (length(trim(notes)) BETWEEN 8 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_row_id)
);
CREATE TABLE IF NOT EXISTS offline_posting_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  event_row_id UUID NOT NULL REFERENCES offline_sync_events(id) ON DELETE RESTRICT,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_hash TEXT NOT NULL CHECK (payload_hash ~ '^[a-f0-9]{64}$'),
  status TEXT NOT NULL DEFAULT 'READY_FOR_POST' CHECK (status IN ('READY_FOR_POST','HELD','CANCELLED')),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_row_id)
);
CREATE INDEX IF NOT EXISTS idx_offline_posting_intents_org_status ON offline_posting_intents(organisation_id,status,created_at DESC);
INSERT INTO role_permissions(role_code,permission_code) VALUES
 ('PLATFORM_ADMIN','offline:validate'),('RETAIL_OWNER','offline:validate'),('RETAIL_MANAGER','offline:validate'),
 ('BAR_OWNER','offline:validate'),('BAR_MANAGER','offline:validate'),
 ('PLATFORM_ADMIN','offline:posting-intents:read'),('RETAIL_OWNER','offline:posting-intents:read'),('RETAIL_MANAGER','offline:posting-intents:read'),
 ('BAR_OWNER','offline:posting-intents:read'),('BAR_MANAGER','offline:posting-intents:read')
ON CONFLICT DO NOTHING;
ALTER TABLE offline_sync_audit DROP CONSTRAINT IF EXISTS offline_sync_audit_action_check;
ALTER TABLE offline_sync_audit ADD CONSTRAINT offline_sync_audit_action_check
  CHECK (action IN ('BATCH_RECEIVED','EVENT_ACCEPTED','EVENT_DUPLICATE','EVENT_CONFLICT','RECONCILIATION_DECISION','VALIDATION_RESULT'));
