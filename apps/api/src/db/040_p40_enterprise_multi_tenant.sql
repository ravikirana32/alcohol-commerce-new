-- P40: Enterprise multi-tenant
-- Review FK assumptions and execute in staging before production.
CREATE TABLE IF NOT EXISTS subscription_plans (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), plan_code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, entitlements JSONB NOT NULL DEFAULT '{}'::jsonb, active BOOLEAN NOT NULL DEFAULT TRUE);
CREATE TABLE IF NOT EXISTS tenant_subscriptions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id), plan_id UUID NOT NULL REFERENCES subscription_plans(id), status TEXT NOT NULL DEFAULT 'trial', starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), ends_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS usage_meter_events (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id), meter_key TEXT NOT NULL, quantity NUMERIC(14,3) NOT NULL, recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
