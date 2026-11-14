-- P514: organisation, outlet and membership lifecycle hardening.
CREATE TABLE IF NOT EXISTS organisation_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role_code TEXT NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACCEPTED','REVOKED','EXPIRED')),
  expires_at TIMESTAMPTZ NOT NULL,
  invited_by UUID NOT NULL REFERENCES users(id),
  accepted_by UUID REFERENCES users(id),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_org_invites_pending_email ON organisation_invitations(organisation_id,email) WHERE status='PENDING';
CREATE INDEX IF NOT EXISTS idx_org_invites_pending ON organisation_invitations(organisation_id, expires_at) WHERE status='PENDING';
CREATE INDEX IF NOT EXISTS idx_org_invites_email ON organisation_invitations(email, status);

INSERT INTO role_permissions(role_code, permission_code) VALUES
 ('RETAIL_OWNER','organisation:manage'),('RETAIL_OWNER','user:manage'),('RETAIL_OWNER','user:read'),('RETAIL_OWNER','audit:read'),
 ('BAR_OWNER','organisation:manage'),('BAR_OWNER','organisation:read'),('BAR_OWNER','user:manage'),('BAR_OWNER','user:read'),('BAR_OWNER','audit:read'),
 ('BAR_OWNER','outlet:manage'),('BAR_OWNER','outlet:read'),('BAR_OWNER','licence:manage'),('BAR_OWNER','licence:read'),
 ('RETAIL_MANAGER','user:read'),('BAR_MANAGER','user:read'),
 ('RETAIL_MANAGER','outlet:read'),('BAR_MANAGER','outlet:read'),('BAR_MANAGER','bar:read'),('BAR_MANAGER','bar:sell'),('BAR_MANAGER','inventory:read'),('BAR_MANAGER','shift:read')
ON CONFLICT DO NOTHING;

-- Explicit membership/outlet scope indexes support revocation and access checks.
CREATE INDEX IF NOT EXISTS idx_user_outlet_access_outlet ON user_outlet_access(outlet_id, user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_org_status ON organisation_memberships(organisation_id, status, role_code);
