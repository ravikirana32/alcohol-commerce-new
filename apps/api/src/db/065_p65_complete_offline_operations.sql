-- P65: Complete offline operations
-- Validate in staging before applying to production.
CREATE TABLE IF NOT EXISTS offline_sync_checkpoints (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), device_ref UUID NOT NULL, last_acked_sequence BIGINT NOT NULL DEFAULT 0, last_sync_at TIMESTAMPTZ, status TEXT NOT NULL DEFAULT 'pending');
