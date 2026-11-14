-- P156: Karnataka retail deployment
-- Registers delivery scope only. No production capability is enabled by this record.
INSERT INTO platform_phase_delivery_register (phase_code, phase_title, delivery_scope, delivery_state)
VALUES ('P156', 'Karnataka retail deployment', 'Prepare a controlled deployment for licensed Karnataka retail outlets with verified licence scope and local operational configuration.', 'scope-defined')
ON CONFLICT (phase_code) DO UPDATE
SET phase_title = EXCLUDED.phase_title,
    delivery_scope = EXCLUDED.delivery_scope,
    updated_at = NOW();
