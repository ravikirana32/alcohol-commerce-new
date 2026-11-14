-- P532: durable exception cases and controlled recovery decisions. No financial reversal is executed here.
CREATE TABLE IF NOT EXISTS offline_recovery_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
  execution_id UUID NOT NULL UNIQUE REFERENCES offline_posting_executions(id) ON DELETE RESTRICT,
  posting_intent_id UUID NOT NULL REFERENCES offline_posting_intents(id) ON DELETE RESTRICT,
  event_row_id UUID NOT NULL REFERENCES offline_sync_events(id) ON DELETE RESTRICT,
  case_type TEXT NOT NULL CHECK (case_type IN ('POSTING_BLOCK','POSTED_TRANSACTION_REVIEW')),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','TRIAGED','RETRY_REQUIRED','CANCELLED','COMPENSATION_PENDING','COMPENSATION_APPROVED','COMPENSATION_REJECTED','RESOLVED')),
  reason_code TEXT NOT NULL,
  description TEXT NOT NULL CHECK (length(trim(description)) BETWEEN 8 AND 1000),
  created_by UUID REFERENCES users(id),
  triaged_by UUID REFERENCES users(id),
  triage_notes TEXT,
  requested_by UUID REFERENCES users(id),
  decided_by UUID REFERENCES users(id),
  decision_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (decided_by IS NULL OR requested_by IS NULL OR decided_by <> requested_by)
);
CREATE INDEX IF NOT EXISTS idx_offline_recovery_org_status_time
  ON offline_recovery_cases(organisation_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_offline_recovery_intent
  ON offline_recovery_cases(organisation_id,posting_intent_id);

CREATE TABLE IF NOT EXISTS offline_recovery_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES offline_recovery_cases(id) ON DELETE RESTRICT,
  actor_user_id UUID REFERENCES users(id),
  action TEXT NOT NULL CHECK (action IN ('CASE_OPENED','TRIAGED','RETRY_REQUESTED','CANCELLED','COMPENSATION_REQUESTED','COMPENSATION_APPROVED','COMPENSATION_REJECTED','RESOLVED')),
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 3 AND 1000),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_offline_recovery_actions_case
  ON offline_recovery_actions(organisation_id,case_id,created_at);

INSERT INTO role_permissions(role_code,permission_code) VALUES
 ('PLATFORM_ADMIN','offline:recovery-read'),('RETAIL_OWNER','offline:recovery-read'),('RETAIL_MANAGER','offline:recovery-read'),
 ('BAR_OWNER','offline:recovery-read'),('BAR_MANAGER','offline:recovery-read'),
 ('PLATFORM_ADMIN','offline:recovery-manage'),('RETAIL_OWNER','offline:recovery-manage'),('RETAIL_MANAGER','offline:recovery-manage'),
 ('BAR_OWNER','offline:recovery-manage'),('BAR_MANAGER','offline:recovery-manage'),
 ('PLATFORM_ADMIN','offline:recovery-compensate'),('RETAIL_OWNER','offline:recovery-compensate')
ON CONFLICT DO NOTHING;

ALTER TABLE offline_sync_audit DROP CONSTRAINT IF EXISTS offline_sync_audit_action_check;
ALTER TABLE offline_sync_audit ADD CONSTRAINT offline_sync_audit_action_check CHECK (action IN
 ('BATCH_RECEIVED','EVENT_ACCEPTED','EVENT_DUPLICATE','EVENT_CONFLICT','RECONCILIATION_DECISION','VALIDATION_RESULT','AUTHORITATIVE_CHECK','POSTING_APPROVAL','LEDGER_POSTED','LEDGER_POST_BLOCKED',
  'RECOVERY_CASE_OPENED','RECOVERY_TRIAGED','RECOVERY_RETRY_REQUESTED','RECOVERY_CANCELLED','RECOVERY_COMPENSATION_REQUESTED','RECOVERY_COMPENSATION_APPROVED','RECOVERY_COMPENSATION_REJECTED'));

COMMENT ON TABLE offline_recovery_cases IS 'P532 durable exception workflow. Recovery actions are append-only; compensation approval is a handoff marker and never mutates sale, stock, payment or journals.';
COMMENT ON TABLE offline_recovery_actions IS 'Append-only maker-checker recovery audit trail.';
