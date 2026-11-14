-- P49: API completion
-- Validate in staging before applying to production.
CREATE TABLE IF NOT EXISTS api_contract_registry (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), method TEXT NOT NULL, route TEXT NOT NULL, permission_key TEXT, request_schema JSONB, response_schema JSONB, status TEXT NOT NULL DEFAULT 'planned', UNIQUE(method,route));
