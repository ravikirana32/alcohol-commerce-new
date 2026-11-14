-- P540: tenant-scoped enterprise integration registry and durable outbound event queue.
-- Credentials are referenced by environment-variable name; secret material is never stored here.
CREATE TABLE IF NOT EXISTS enterprise_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE RESTRICT,
  provider_code TEXT NOT NULL CHECK (provider_code IN ('ACCOUNTING_EXPORT','ERP','DELIVERY','CRM','DATA_WAREHOUSE','CUSTOM')),
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 2 AND 120),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','CONFIGURED','PAUSED','REVOKED')),
  endpoint_url TEXT CHECK (endpoint_url IS NULL OR endpoint_url ~ '^https://'),
  credential_env_ref TEXT CHECK (credential_env_ref IS NULL OR credential_env_ref ~ '^[A-Z][A-Z0-9_]{2,100}$'),
  config JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(config)='object'),
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organisation_id,provider_code,display_name)
);
CREATE INDEX IF NOT EXISTS idx_enterprise_integrations_org_status ON enterprise_integrations(organisation_id,status,created_at DESC);

CREATE TABLE IF NOT EXISTS integration_outbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE RESTRICT,
  integration_id UUID NOT NULL REFERENCES enterprise_integrations(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (length(event_type) BETWEEN 3 AND 100),
  idempotency_key TEXT NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 200),
  payload JSONB NOT NULL CHECK (jsonb_typeof(payload)='object'),
  status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED','HELD','DELIVERED','FAILED','CANCELLED')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organisation_id,integration_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_integration_outbox_due ON integration_outbox_events(status,next_attempt_at,created_at) WHERE status IN ('QUEUED','FAILED');

CREATE TABLE IF NOT EXISTS integration_delivery_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES integration_outbox_events(id) ON DELETE RESTRICT,
  outcome TEXT NOT NULL CHECK (outcome IN ('SUCCESS','RETRYABLE_FAILURE','PERMANENT_FAILURE','HELD')),
  http_status INTEGER CHECK (http_status BETWEEN 100 AND 599),
  response_fingerprint TEXT,
  error_code TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_integration_attempts_event ON integration_delivery_attempts(event_id,attempted_at DESC);

INSERT INTO role_permissions(role_code,permission_code) VALUES
 ('PLATFORM_ADMIN','integration:manage'),('PLATFORM_ADMIN','integration:read'),
 ('RETAIL_OWNER','integration:manage'),('RETAIL_OWNER','integration:read'),
 ('BAR_OWNER','integration:manage'),('BAR_OWNER','integration:read'),
 ('RETAIL_MANAGER','integration:read'),('BAR_MANAGER','integration:read')
ON CONFLICT DO NOTHING;
