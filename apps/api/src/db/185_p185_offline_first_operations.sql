-- P185: Offline-first operations
-- Delivery metadata only. This does not implement or enable the described capability.
INSERT INTO platform_phase_delivery_register (phase_code, phase_title, delivery_scope, delivery_state)
VALUES ('P185', 'Offline-first operations', 'Deliver safe offline billing and reliable synchronisation for approved POS devices.', 'scope-defined')
ON CONFLICT (phase_code) DO UPDATE
SET phase_title = EXCLUDED.phase_title,
    delivery_scope = EXCLUDED.delivery_scope,
    updated_at = NOW();
