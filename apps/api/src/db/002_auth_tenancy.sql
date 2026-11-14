CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('INVITED','ACTIVE','LOCKED','DISABLED')),
  is_platform_admin BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at TIMESTAMPTZ,
  password_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organisation_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  role_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('INVITED','ACTIVE','SUSPENDED','REVOKED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, organisation_id)
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_code TEXT NOT NULL,
  permission_code TEXT NOT NULL,
  PRIMARY KEY (role_code, permission_code)
);

CREATE TABLE IF NOT EXISTS user_outlet_access (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, outlet_id)
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_id TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memberships_user ON organisation_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_org ON organisation_memberships(organisation_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON auth_sessions(expires_at);

INSERT INTO role_permissions (role_code, permission_code) VALUES
  ('PLATFORM_ADMIN', 'platform:manage'),
  ('PLATFORM_ADMIN', 'organisation:read'),
  ('PLATFORM_ADMIN', 'organisation:manage'),
  ('PLATFORM_ADMIN', 'user:manage'),
  ('PLATFORM_ADMIN', 'audit:read'),
  ('RETAIL_OWNER', 'retail:manage'),
  ('RETAIL_OWNER', 'retail:billing'),
  ('RETAIL_OWNER', 'inventory:manage'),
  ('RETAIL_OWNER', 'reports:read'),
  ('RETAIL_MANAGER', 'retail:billing'),
  ('RETAIL_MANAGER', 'inventory:read'),
  ('RETAIL_MANAGER', 'inventory:adjust:request'),
  ('RETAIL_MANAGER', 'reports:read'),
  ('CASHIER', 'retail:billing'),
  ('BAR_OWNER', 'bar:manage'),
  ('BAR_OWNER', 'bar:billing'),
  ('BAR_OWNER', 'inventory:manage'),
  ('BAR_OWNER', 'reports:read'),
  ('BARTENDER', 'bar:billing'),
  ('BRAND_ADMIN', 'brand:manage'),
  ('BRAND_ANALYST', 'brand:analytics:read'),
  ('DISTRIBUTOR_ADMIN', 'distribution:manage'),
  ('SALES_REP', 'distribution:visit'),
  ('AUDITOR', 'audit:read')
ON CONFLICT DO NOTHING;
