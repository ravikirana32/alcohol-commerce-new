-- P583: shared auth throttling and tamper-evident audit retention controls.
CREATE TABLE IF NOT EXISTS p583_rate_limit_buckets (
 bucket_key CHAR(64) PRIMARY KEY, window_started_at TIMESTAMPTZ NOT NULL,
 request_count INTEGER NOT NULL CHECK(request_count>=0), expires_at TIMESTAMPTZ NOT NULL,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_p583_rate_limit_expiry ON p583_rate_limit_buckets(expires_at);
CREATE OR REPLACE FUNCTION p583_reject_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'security_audit_events is append-only'; END; $$;
DROP TRIGGER IF EXISTS trg_p583_audit_no_update ON security_audit_events;
CREATE TRIGGER trg_p583_audit_no_update BEFORE UPDATE OR DELETE ON security_audit_events
FOR EACH ROW EXECUTE FUNCTION p583_reject_audit_mutation();
