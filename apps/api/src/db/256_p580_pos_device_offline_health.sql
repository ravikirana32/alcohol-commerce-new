-- P580: operational device health and durable offline sync checkpoints.
CREATE TABLE IF NOT EXISTS p580_device_health_events (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE RESTRICT,
 device_id UUID NOT NULL REFERENCES pos_devices(id) ON DELETE RESTRICT,
 outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
 health_status TEXT NOT NULL CHECK(health_status IN ('HEALTHY','DEGRADED','UNHEALTHY')),
 app_version TEXT NOT NULL CHECK(length(app_version) BETWEEN 1 AND 80), platform_version TEXT,
 battery_percent SMALLINT CHECK(battery_percent BETWEEN 0 AND 100), storage_free_bytes BIGINT CHECK(storage_free_bytes >= 0),
 queue_depth INTEGER NOT NULL CHECK(queue_depth >= 0), last_local_event_at TIMESTAMPTZ,
 reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), reported_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_p580_device_health_recent ON p580_device_health_events(organisation_id,device_id,reported_at DESC);
CREATE TABLE IF NOT EXISTS p580_offline_sync_checkpoints (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE RESTRICT,
 device_id UUID NOT NULL,
 outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
 max_seen_sequence BIGINT NOT NULL DEFAULT 0 CHECK(max_seen_sequence >= 0),
 last_batch_id UUID,
 updated_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(organisation_id,device_id),
 FOREIGN KEY(device_id,organisation_id,outlet_id) REFERENCES offline_sync_devices(id,organisation_id,outlet_id) ON DELETE RESTRICT,
 FOREIGN KEY(last_batch_id,organisation_id,device_id) REFERENCES offline_sync_batches(id,organisation_id,device_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_p580_checkpoint_outlet ON p580_offline_sync_checkpoints(organisation_id,outlet_id,updated_at DESC);
INSERT INTO role_permissions(role_code,permission_code) VALUES
 ('PLATFORM_ADMIN','device:health:read'),('RETAIL_OWNER','device:health:read'),('BAR_OWNER','device:health:read'),
 ('RETAIL_MANAGER','device:health:read'),('BAR_MANAGER','device:health:read'),('OUTLET_MANAGER','device:health:read'),
 ('PLATFORM_ADMIN','offline:checkpoint:read'),('RETAIL_OWNER','offline:checkpoint:read'),('BAR_OWNER','offline:checkpoint:read'),
 ('RETAIL_MANAGER','offline:checkpoint:read'),('BAR_MANAGER','offline:checkpoint:read'),('OUTLET_MANAGER','offline:checkpoint:read')
ON CONFLICT DO NOTHING;
