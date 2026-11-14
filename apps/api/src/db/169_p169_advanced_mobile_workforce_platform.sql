-- P169: Advanced mobile workforce platform
-- Registers delivery scope only. No production capability is enabled by this record.
INSERT INTO platform_phase_delivery_register (phase_code, phase_title, delivery_scope, delivery_state)
VALUES ('P169', 'Advanced mobile workforce platform', 'Support field teams and outlet staff with secure mobile tasks, visits, checklists and offline-safe drafts.', 'scope-defined')
ON CONFLICT (phase_code) DO UPDATE
SET phase_title = EXCLUDED.phase_title,
    delivery_scope = EXCLUDED.delivery_scope,
    updated_at = NOW();
