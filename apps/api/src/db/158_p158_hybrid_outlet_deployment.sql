-- P158: Hybrid outlet deployment
-- Registers delivery scope only. No production capability is enabled by this record.
INSERT INTO platform_phase_delivery_register (phase_code, phase_title, delivery_scope, delivery_state)
VALUES ('P158', 'Hybrid outlet deployment', 'Validate hybrid retail and on-premise operations with licence-gated modes, shared stock controls and separate reporting.', 'scope-defined')
ON CONFLICT (phase_code) DO UPDATE
SET phase_title = EXCLUDED.phase_title,
    delivery_scope = EXCLUDED.delivery_scope,
    updated_at = NOW();
