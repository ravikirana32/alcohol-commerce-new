-- P541: append-only security audit evidence and operational reliability controls.
CREATE TABLE IF NOT EXISTS security_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE RESTRICT,
  actor_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  event_code TEXT NOT NULL CHECK (length(event_code) BETWEEN 3 AND 100),
  resource_type TEXT NOT NULL CHECK (length(resource_type) BETWEEN 2 AND 80),
  resource_id TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN ('SUCCESS','DENIED','FAILURE')),
  request_id TEXT,
  source_ip INET,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata)='object'),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_security_audit_org_time ON security_audit_events(organisation_id,occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_actor_time ON security_audit_events(actor_user_id,occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_event_time ON security_audit_events(event_code,occurred_at DESC);

CREATE OR REPLACE FUNCTION reject_security_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'security_audit_events is append-only';
END; $$;
DROP TRIGGER IF EXISTS trg_security_audit_no_update ON security_audit_events;
CREATE TRIGGER trg_security_audit_no_update BEFORE UPDATE OR DELETE ON security_audit_events
FOR EACH ROW EXECUTE FUNCTION reject_security_audit_mutation();

CREATE TABLE IF NOT EXISTS operational_recovery_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_code TEXT NOT NULL CHECK (length(environment_code) BETWEEN 2 AND 40),
  evidence_type TEXT NOT NULL CHECK (evidence_type IN ('BACKUP_CREATED','RESTORE_VERIFIED','DRILL_FAILED')),
  evidence_ref TEXT NOT NULL CHECK (length(evidence_ref) BETWEEN 3 AND 500),
  checksum_sha256 TEXT CHECK (checksum_sha256 IS NULL OR checksum_sha256 ~ '^[a-f0-9]{64}$'),
  verified_by UUID REFERENCES users(id) ON DELETE RESTRICT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details)='object'),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_recovery_evidence_time ON operational_recovery_evidence(environment_code,recorded_at DESC);

INSERT INTO role_permissions(role_code,permission_code) VALUES
 ('PLATFORM_ADMIN','security:audit:read'),('RETAIL_OWNER','security:audit:read'),('BAR_OWNER','security:audit:read')
ON CONFLICT DO NOTHING;
