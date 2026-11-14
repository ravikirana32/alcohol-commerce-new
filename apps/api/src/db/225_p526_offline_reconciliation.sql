-- P526: independent maker-checker review for offline events. Approval is not ledger posting.
ALTER TABLE offline_sync_batches ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES users(id);
UPDATE offline_sync_batches b SET submitted_by = a.actor_user_id
FROM offline_sync_audit a WHERE a.batch_id=b.id AND a.action='BATCH_RECEIVED' AND b.submitted_by IS NULL;
ALTER TABLE offline_sync_batches ALTER COLUMN submitted_by SET NOT NULL;
ALTER TABLE offline_sync_batches DROP CONSTRAINT IF EXISTS offline_sync_batches_status_check;
ALTER TABLE offline_sync_batches ADD CONSTRAINT offline_sync_batches_status_check
  CHECK (status IN ('RECEIVED','PARTIAL','REVIEW_REQUIRED','REJECTED','REVIEWED'));
ALTER TABLE offline_sync_events DROP CONSTRAINT IF EXISTS offline_sync_events_status_check;
ALTER TABLE offline_sync_events ADD CONSTRAINT offline_sync_events_status_check
  CHECK (status IN ('REVIEW_REQUIRED','DUPLICATE','CONFLICT','REJECTED','APPROVED_NO_POST'));
ALTER TABLE offline_sync_events ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id);
ALTER TABLE offline_sync_events ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE offline_sync_events ADD COLUMN IF NOT EXISTS review_reason TEXT;
ALTER TABLE offline_sync_audit DROP CONSTRAINT IF EXISTS offline_sync_audit_action_check;
ALTER TABLE offline_sync_audit ADD CONSTRAINT offline_sync_audit_action_check
  CHECK (action IN ('BATCH_RECEIVED','EVENT_ACCEPTED','EVENT_DUPLICATE','EVENT_CONFLICT','RECONCILIATION_DECISION'));
CREATE INDEX IF NOT EXISTS idx_offline_sync_events_review_queue
  ON offline_sync_events(organisation_id, received_at) WHERE status IN ('REVIEW_REQUIRED','CONFLICT');
INSERT INTO role_permissions(role_code,permission_code) VALUES
 ('PLATFORM_ADMIN','offline:review'),('RETAIL_OWNER','offline:review'),('RETAIL_MANAGER','offline:review'),
 ('BAR_OWNER','offline:review'),('BAR_MANAGER','offline:review')
ON CONFLICT DO NOTHING;
