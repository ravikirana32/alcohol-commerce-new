CREATE TABLE IF NOT EXISTS device_registrations (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id),
 outlet_id UUID NOT NULL REFERENCES outlets(id), device_key_hash TEXT NOT NULL, device_label TEXT,
 status TEXT NOT NULL DEFAULT 'ACTIVE', last_seen_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS sync_batches (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id),
 outlet_id UUID NOT NULL REFERENCES outlets(id), device_id UUID REFERENCES device_registrations(id),
 idempotency_key TEXT NOT NULL, payload_hash TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'RECEIVED',
 result JSONB NOT NULL DEFAULT '{}', received_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(outlet_id,idempotency_key)
);
CREATE TABLE IF NOT EXISTS integration_connections (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id),
 provider TEXT NOT NULL, connection_status TEXT NOT NULL DEFAULT 'DISCONNECTED', secret_reference TEXT,
 configuration JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(organisation_id,provider)
);
CREATE TABLE IF NOT EXISTS integration_events (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id),
 provider TEXT NOT NULL, event_type TEXT NOT NULL, external_id TEXT, payload JSONB NOT NULL DEFAULT '{}',
 processing_status TEXT NOT NULL DEFAULT 'RECEIVED', created_at TIMESTAMPTZ DEFAULT NOW()
);
