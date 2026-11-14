-- P176-P200 delivery register; metadata only, no product capability is enabled.
CREATE TABLE IF NOT EXISTS platform_phase_delivery_register (
  phase_code TEXT PRIMARY KEY,
  phase_title TEXT NOT NULL,
  delivery_scope TEXT NOT NULL,
  delivery_state TEXT NOT NULL DEFAULT 'planned',
  evidence_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
