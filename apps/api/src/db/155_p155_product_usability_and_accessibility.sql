-- P155: Product usability and accessibility
-- Registers delivery scope only. No production capability is enabled by this record.
INSERT INTO platform_phase_delivery_register (phase_code, phase_title, delivery_scope, delivery_state)
VALUES ('P155', 'Product usability and accessibility', 'Improve usability for cashier, bartender, manager and administrator tasks, including accessible keyboard and assistive-technology operation.', 'scope-defined')
ON CONFLICT (phase_code) DO UPDATE
SET phase_title = EXCLUDED.phase_title,
    delivery_scope = EXCLUDED.delivery_scope,
    updated_at = NOW();
