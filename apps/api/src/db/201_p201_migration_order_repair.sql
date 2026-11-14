-- P201 migration repair tracking and safe indexes.
CREATE INDEX IF NOT EXISTS idx_phase_delivery_state
  ON platform_phase_delivery_register(delivery_state, phase_code);
