-- P525: durable, idempotent offline sync intake. Financial commands are quarantined for review;
-- this migration deliberately does not post sales, inventory, tenders, or accounting entries.
CREATE TABLE IF NOT EXISTS offline_sync_devices (
  id UUID PRIMARY KEY,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  label TEXT NOT NULL CHECK (length(trim(label)) BETWEEN 2 AND 120),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','REVOKED')),
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(id, organisation_id, outlet_id)
);
CREATE INDEX IF NOT EXISTS idx_offline_devices_org_outlet ON offline_sync_devices(organisation_id,outlet_id,status);

CREATE TABLE IF NOT EXISTS offline_sync_batches (
  id UUID PRIMARY KEY,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  device_id UUID NOT NULL,
  payload_hash TEXT NOT NULL CHECK (payload_hash ~ '^[a-f0-9]{64}$'),
  event_count INTEGER NOT NULL CHECK (event_count BETWEEN 1 AND 500),
  status TEXT NOT NULL DEFAULT 'RECEIVED' CHECK (status IN ('RECEIVED','PARTIAL','REVIEW_REQUIRED','REJECTED')),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(id,organisation_id,device_id),
  FOREIGN KEY(device_id,organisation_id,outlet_id) REFERENCES offline_sync_devices(id,organisation_id,outlet_id)
);
CREATE INDEX IF NOT EXISTS idx_offline_sync_batches_org_received ON offline_sync_batches(organisation_id,received_at DESC);

CREATE TABLE IF NOT EXISTS offline_sync_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  device_id UUID NOT NULL,
  batch_id UUID NOT NULL,
  event_id TEXT NOT NULL CHECK (length(event_id) BETWEEN 8 AND 160),
  sequence_no BIGINT NOT NULL CHECK (sequence_no > 0),
  event_type TEXT NOT NULL CHECK (event_type IN ('RETAIL_SALE','BAR_CHECKOUT','STOCK_ADJUSTMENT','DEVICE_DIAGNOSTIC')),
  payload JSONB NOT NULL,
  payload_hash TEXT NOT NULL CHECK (payload_hash ~ '^[a-f0-9]{64}$'),
  status TEXT NOT NULL DEFAULT 'REVIEW_REQUIRED' CHECK (status IN ('REVIEW_REQUIRED','DUPLICATE','CONFLICT','REJECTED','RECONCILED')),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organisation_id,device_id,event_id),
  UNIQUE(organisation_id,device_id,sequence_no),
  FOREIGN KEY(batch_id,organisation_id,device_id) REFERENCES offline_sync_batches(id,organisation_id,device_id),
  FOREIGN KEY(device_id,organisation_id,outlet_id) REFERENCES offline_sync_devices(id,organisation_id,outlet_id)
);
CREATE INDEX IF NOT EXISTS idx_offline_sync_events_review ON offline_sync_events(organisation_id,status,received_at);

CREATE TABLE IF NOT EXISTS offline_sync_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES offline_sync_batches(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users(id),
  action TEXT NOT NULL CHECK (action IN ('BATCH_RECEIVED','EVENT_ACCEPTED','EVENT_DUPLICATE','EVENT_CONFLICT','RECONCILIATION_DECISION')),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO role_permissions(role_code,permission_code) VALUES
 ('PLATFORM_ADMIN','offline:manage'),('PLATFORM_ADMIN','offline:read'),('PLATFORM_ADMIN','offline:sync'),
 ('RETAIL_OWNER','offline:manage'),('RETAIL_OWNER','offline:read'),('RETAIL_OWNER','offline:sync'),
 ('RETAIL_MANAGER','offline:manage'),('RETAIL_MANAGER','offline:read'),('RETAIL_MANAGER','offline:sync'),
 ('BAR_OWNER','offline:manage'),('BAR_OWNER','offline:read'),('BAR_OWNER','offline:sync'),
 ('BAR_MANAGER','offline:manage'),('BAR_MANAGER','offline:read'),('BAR_MANAGER','offline:sync')
ON CONFLICT DO NOTHING;
