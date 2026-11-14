-- P154: Data accuracy and reconciliation certification
-- Registers delivery scope only. No production capability is enabled by this record.
INSERT INTO platform_phase_delivery_register (phase_code, phase_title, delivery_scope, delivery_state)
VALUES ('P154', 'Data accuracy and reconciliation certification', 'Validate stock, money, tax configuration, ledgers and event histories against independent reconciliation rules.', 'scope-defined')
ON CONFLICT (phase_code) DO UPDATE
SET phase_title = EXCLUDED.phase_title,
    delivery_scope = EXCLUDED.delivery_scope,
    updated_at = NOW();
