-- P126: Complete codebase implementation
-- Phase capability registration only. This is not evidence of workflow completion.
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
VALUES ('p126_complete_codebase_implementation', 126, 'Complete codebase implementation', FALSE, false,
 '{"phase":"P126","status":"implementation_backlog","activation":"blocked_until_verified"}'::jsonb)
ON CONFLICT (capability_key) DO UPDATE SET
 phase_number=EXCLUDED.phase_number, capability_name=EXCLUDED.capability_name,
 requires_review=EXCLUDED.requires_review, metadata=EXCLUDED.metadata, updated_at=NOW();
