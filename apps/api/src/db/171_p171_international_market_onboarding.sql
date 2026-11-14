-- P171: International market onboarding
-- Registers delivery scope only. No production capability is enabled by this record.
INSERT INTO platform_phase_delivery_register (phase_code, phase_title, delivery_scope, delivery_state)
VALUES ('P171', 'International market onboarding', 'Create a repeatable onboarding framework for new jurisdictions without assuming one country''s alcohol rules apply elsewhere.', 'scope-defined')
ON CONFLICT (phase_code) DO UPDATE
SET phase_title = EXCLUDED.phase_title,
    delivery_scope = EXCLUDED.delivery_scope,
    updated_at = NOW();
