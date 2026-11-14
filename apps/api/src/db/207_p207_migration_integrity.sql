-- P207: persist content hashes for migration drift detection.
CREATE TABLE IF NOT EXISTS schema_migration_checksums (
  filename TEXT PRIMARY KEY,
  sha256 CHAR(64) NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_schema_migration_checksums_verified_at
  ON schema_migration_checksums(verified_at DESC);
