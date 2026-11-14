-- P55: Advanced bar operations
-- Validate in staging before applying to production.
CREATE TABLE IF NOT EXISTS bar_floor_tables (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), outlet_id UUID NOT NULL, table_code TEXT NOT NULL, capacity INTEGER NOT NULL DEFAULT 2, active BOOLEAN NOT NULL DEFAULT TRUE, UNIQUE(outlet_id,table_code));
