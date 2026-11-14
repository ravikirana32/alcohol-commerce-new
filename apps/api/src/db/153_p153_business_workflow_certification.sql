-- P153: Business workflow certification
-- Registers delivery scope only. No production capability is enabled by this record.
INSERT INTO platform_phase_delivery_register (phase_code, phase_title, delivery_scope, delivery_state)
VALUES ('P153', 'Business workflow certification', 'Certify end-to-end operational journeys for licensed retail, bar and hybrid outlet profiles.', 'scope-defined')
ON CONFLICT (phase_code) DO UPDATE
SET phase_title = EXCLUDED.phase_title,
    delivery_scope = EXCLUDED.delivery_scope,
    updated_at = NOW();
