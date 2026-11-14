CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS organisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  organisation_type TEXT NOT NULL CHECK (organisation_type IN ('RETAILER','BAR_OPERATOR','BRAND','DISTRIBUTOR','PLATFORM')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACTIVE','SUSPENDED','CLOSED')),
  country_code CHAR(2) NOT NULL DEFAULT 'IN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS outlets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  outlet_code TEXT NOT NULL,
  name TEXT NOT NULL,
  operating_mode TEXT NOT NULL CHECK (operating_mode IN ('RETAIL_ONLY','BAR_ONLY','HYBRID')),
  state_code TEXT NOT NULL,
  district TEXT,
  address JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACTIVE','SUSPENDED','CLOSED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organisation_id, outlet_code)
);

CREATE TABLE IF NOT EXISTS outlet_licences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID NOT NULL REFERENCES outlets(id),
  jurisdiction_code TEXT NOT NULL,
  licence_type TEXT NOT NULL,
  licence_number_encrypted TEXT,
  valid_from DATE,
  valid_until DATE,
  verification_status TEXT NOT NULL DEFAULT 'UNVERIFIED'
    CHECK (verification_status IN ('UNVERIFIED','PENDING_REVIEW','VERIFIED','REJECTED','EXPIRED')),
  permitted_capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence_document_key TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id),
  outlet_id UUID REFERENCES outlets(id),
  actor_user_id UUID,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outlets_org ON outlets(organisation_id);
CREATE INDEX IF NOT EXISTS idx_licences_outlet ON outlet_licences(outlet_id);
CREATE INDEX IF NOT EXISTS idx_licences_expiry ON outlet_licences(valid_until);
CREATE INDEX IF NOT EXISTS idx_audit_org_time ON audit_events(organisation_id, occurred_at DESC);

-- This is a foundation schema only. Row-level security, authenticated actor identity,
-- tenant context enforcement and encryption-key management must be implemented
-- before any production data is stored.
