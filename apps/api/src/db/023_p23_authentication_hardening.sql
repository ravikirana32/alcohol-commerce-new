-- P23: Authentication hardening
-- Review FK assumptions and execute in staging before production.
CREATE TABLE IF NOT EXISTS auth_refresh_families (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id), token_hash TEXT NOT NULL UNIQUE, parent_token_hash TEXT, expires_at TIMESTAMPTZ NOT NULL, revoked_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS auth_recovery_challenges (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id), purpose TEXT NOT NULL CHECK (purpose IN ('password_reset','invitation','mfa')), token_hash TEXT NOT NULL UNIQUE, expires_at TIMESTAMPTZ NOT NULL, consumed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS auth_login_attempts (id BIGSERIAL PRIMARY KEY, login_key_hash TEXT NOT NULL, succeeded BOOLEAN NOT NULL, ip_hash TEXT, attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
