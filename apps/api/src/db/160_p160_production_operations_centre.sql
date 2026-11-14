-- P160: Production operations centre
-- Registers delivery scope only. No production capability is enabled by this record.
INSERT INTO platform_phase_delivery_register (phase_code, phase_title, delivery_scope, delivery_state)
VALUES ('P160', 'Production operations centre', 'Establish production support processes for incidents, monitoring, backups, releases and outlet service continuity.', 'scope-defined')
ON CONFLICT (phase_code) DO UPDATE
SET phase_title = EXCLUDED.phase_title,
    delivery_scope = EXCLUDED.delivery_scope,
    updated_at = NOW();
