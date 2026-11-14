-- P157: Karnataka bar deployment
-- Registers delivery scope only. No production capability is enabled by this record.
INSERT INTO platform_phase_delivery_register (phase_code, phase_title, delivery_scope, delivery_state)
VALUES ('P157', 'Karnataka bar deployment', 'Prepare a controlled deployment for licensed Karnataka bars with measure-based stock control and shift reconciliation.', 'scope-defined')
ON CONFLICT (phase_code) DO UPDATE
SET phase_title = EXCLUDED.phase_title,
    delivery_scope = EXCLUDED.delivery_scope,
    updated_at = NOW();
