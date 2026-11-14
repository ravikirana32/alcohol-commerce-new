-- P50: Frontend completion
-- Validate in staging before applying to production.
CREATE TABLE IF NOT EXISTS ui_module_registry (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), module_key TEXT NOT NULL UNIQUE, route_path TEXT NOT NULL, permission_key TEXT, status TEXT NOT NULL DEFAULT 'planned', metadata JSONB NOT NULL DEFAULT '{}'::jsonb);
