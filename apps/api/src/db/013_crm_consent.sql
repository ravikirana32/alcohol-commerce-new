CREATE TABLE IF NOT EXISTS customers (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id),
 display_name TEXT, phone_e164 TEXT, email TEXT, birth_date DATE, status TEXT NOT NULL DEFAULT 'ACTIVE',
 created_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(organisation_id,phone_e164)
);
CREATE TABLE IF NOT EXISTS customer_consents (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id),
 customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE, purpose TEXT NOT NULL,
 granted BOOLEAN NOT NULL, captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), revoked_at TIMESTAMPTZ,
 capture_channel TEXT, policy_version TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS loyalty_accounts (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id),
 customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE, points_balance BIGINT NOT NULL DEFAULT 0 CHECK(points_balance>=0),
 status TEXT NOT NULL DEFAULT 'ACTIVE', UNIQUE(customer_id)
);
CREATE TABLE IF NOT EXISTS loyalty_ledger (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), account_id UUID NOT NULL REFERENCES loyalty_accounts(id),
 points_delta BIGINT NOT NULL CHECK(points_delta<>0), reason TEXT NOT NULL, reference_id UUID, created_at TIMESTAMPTZ DEFAULT NOW()
);
