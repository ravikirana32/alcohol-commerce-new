-- P201 repair: create phase delivery metadata before P151/P176 seed migrations.
-- This filename sorts after the P150 migration but before P151 under the migration runner.
CREATE TABLE IF NOT EXISTS platform_phase_delivery_register (
  phase_code TEXT PRIMARY KEY,
  phase_title TEXT NOT NULL,
  delivery_scope TEXT NOT NULL,
  delivery_state TEXT NOT NULL DEFAULT 'planned',
  evidence_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
