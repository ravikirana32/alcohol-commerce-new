-- P538: organisation-scoped POS device registry and cryptographic device proof.
CREATE TABLE IF NOT EXISTS pos_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE RESTRICT,
  device_name TEXT NOT NULL CHECK (length(device_name) BETWEEN 2 AND 120),
  platform TEXT NOT NULL CHECK (platform IN ('IOS','ANDROID','WINDOWS','MACOS','LINUX','BROWSER')),
  public_key_pem TEXT NOT NULL CHECK (length(public_key_pem) BETWEEN 80 AND 12000),
  key_fingerprint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','TRUSTED','REVOKED')),
  last_attested_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organisation_id,key_fingerprint)
);
CREATE INDEX IF NOT EXISTS idx_pos_devices_org_status ON pos_devices(organisation_id,status,created_at DESC);
CREATE TABLE IF NOT EXISTS pos_device_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES pos_devices(id) ON DELETE RESTRICT,
  challenge_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pos_device_challenge_pending ON pos_device_challenges(device_id,expires_at) WHERE consumed_at IS NULL;
INSERT INTO role_permissions(role_code,permission_code) VALUES
 ('PLATFORM_ADMIN','device:manage'),('RETAIL_OWNER','device:manage'),('BAR_OWNER','device:manage'),
 ('RETAIL_MANAGER','device:read'),('BAR_MANAGER','device:read')
ON CONFLICT DO NOTHING;
