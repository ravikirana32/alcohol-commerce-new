-- P194: Karnataka compliance validation
-- Delivery metadata only. This does not implement or enable the described capability.
INSERT INTO platform_phase_delivery_register (phase_code, phase_title, delivery_scope, delivery_state)
VALUES ('P194', 'Karnataka compliance validation', 'Validate Karnataka-specific licence, excise, reporting and permitted operating workflows.', 'scope-defined')
ON CONFLICT (phase_code) DO UPDATE
SET phase_title = EXCLUDED.phase_title,
    delivery_scope = EXCLUDED.delivery_scope,
    updated_at = NOW();
