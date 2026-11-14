-- P167: Advanced fraud detection
-- Registers delivery scope only. No production capability is enabled by this record.
INSERT INTO platform_phase_delivery_register (phase_code, phase_title, delivery_scope, delivery_state)
VALUES ('P167', 'Advanced fraud detection', 'Detect suspicious stock, cash, refund, void, discount and account-access patterns with reviewable alerts.', 'scope-defined')
ON CONFLICT (phase_code) DO UPDATE
SET phase_title = EXCLUDED.phase_title,
    delivery_scope = EXCLUDED.delivery_scope,
    updated_at = NOW();
