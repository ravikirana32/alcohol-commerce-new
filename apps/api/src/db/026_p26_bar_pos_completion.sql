-- P26: Bar POS completion
-- Review FK assumptions and execute in staging before production.
CREATE TABLE IF NOT EXISTS bar_service_tables (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), outlet_id UUID NOT NULL REFERENCES outlets(id), table_code TEXT NOT NULL, capacity INTEGER NOT NULL DEFAULT 2, active BOOLEAN NOT NULL DEFAULT TRUE, UNIQUE(outlet_id, table_code));
CREATE TABLE IF NOT EXISTS bar_ticket_actions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), ticket_id UUID NOT NULL, action TEXT NOT NULL, actor_user_id UUID REFERENCES users(id), reason TEXT, payload JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS bar_service_periods (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), outlet_id UUID NOT NULL REFERENCES outlets(id), name TEXT NOT NULL, starts_at TIME NOT NULL, ends_at TIME NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE);
