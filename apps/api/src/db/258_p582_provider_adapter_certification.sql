-- P582: provider adapter contract and certification evidence; dispatch stays disabled.
CREATE TABLE IF NOT EXISTS p582_provider_certification_runs (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE RESTRICT,
 integration_id UUID NOT NULL REFERENCES enterprise_integrations(id) ON DELETE RESTRICT,
 event_type TEXT NOT NULL, payload_hash CHAR(64) NOT NULL, idempotency_key TEXT NOT NULL,
 endpoint_host TEXT NOT NULL, accepted BOOLEAN NOT NULL, rejection_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
 dispatch_allowed BOOLEAN NOT NULL DEFAULT FALSE CHECK(dispatch_allowed=FALSE),
 assessed_by UUID NOT NULL REFERENCES users(id), assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_p582_cert_org_time ON p582_provider_certification_runs(organisation_id,assessed_at DESC);
