-- P151: Complete implementation gap closure
-- Registers delivery scope only. No production capability is enabled by this record.
INSERT INTO platform_phase_delivery_register (phase_code, phase_title, delivery_scope, delivery_state)
VALUES ('P151', 'Complete implementation gap closure', 'Inventory every incomplete API, UI, persistence and integration flow; prioritise critical transaction paths and close verified gaps.', 'scope-defined')
ON CONFLICT (phase_code) DO UPDATE
SET phase_title = EXCLUDED.phase_title,
    delivery_scope = EXCLUDED.delivery_scope,
    updated_at = NOW();
