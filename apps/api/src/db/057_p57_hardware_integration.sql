-- P57: Hardware integration
-- Validate in staging before applying to production.
CREATE TABLE IF NOT EXISTS hardware_devices (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), outlet_id UUID NOT NULL, device_type TEXT NOT NULL, device_name TEXT NOT NULL, connection_config JSONB NOT NULL DEFAULT '{}'::jsonb, status TEXT NOT NULL DEFAULT 'unpaired');
