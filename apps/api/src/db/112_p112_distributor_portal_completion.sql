-- P112: Distributor portal completion
-- Phase contract/capability registration. This does not imply the workflow is implemented.
CREATE TABLE IF NOT EXISTS platform_phase_capabilities (
  capability_key TEXT PRIMARY KEY,
  phase_number INTEGER NOT NULL,
  capability_name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  requires_review BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO platform_phase_capabilities
 (capability_key, phase_number, capability_name, enabled, requires_review, metadata)
VALUES ('p112_distributor_portal_completion', 112, 'Distributor portal completion', FALSE, false,
 '{"phase":"P112","status":"implementation_backlog","activation":"blocked_until_verified"}'::jsonb)
ON CONFLICT (capability_key) DO UPDATE SET
 phase_number=EXCLUDED.phase_number, capability_name=EXCLUDED.capability_name,
 requires_review=EXCLUDED.requires_review, metadata=EXCLUDED.metadata, updated_at=NOW();
