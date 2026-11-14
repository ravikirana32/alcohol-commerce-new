-- P87: Intelligent inventory optimisation
-- Disabled capability registration only; no legal or production certification implied.
CREATE TABLE IF NOT EXISTS platform_phase_capabilities (
  capability_key TEXT PRIMARY KEY,
  phase_number INTEGER NOT NULL,
  capability_name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  requires_legal_review BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO platform_phase_capabilities
  (capability_key, phase_number, capability_name, enabled, requires_legal_review, metadata)
VALUES ('p87_intelligent_inventory_optimisation', 87, 'Intelligent inventory optimisation', FALSE,
 false,
 '{"phase":"P87","status":"foundation_scaffold","activation":"explicit_review_required"}'::jsonb)
ON CONFLICT (capability_key) DO UPDATE SET
 phase_number=EXCLUDED.phase_number, capability_name=EXCLUDED.capability_name,
 requires_legal_review=EXCLUDED.requires_legal_review, metadata=EXCLUDED.metadata,
 updated_at=NOW();
