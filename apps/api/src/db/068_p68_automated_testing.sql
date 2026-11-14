-- P68: Automated testing
-- Validate in staging before applying to production.
CREATE TABLE IF NOT EXISTS automated_test_catalogue (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), suite_key TEXT NOT NULL, test_key TEXT NOT NULL, criticality TEXT NOT NULL DEFAULT 'normal', enabled BOOLEAN NOT NULL DEFAULT TRUE, UNIQUE(suite_key,test_key));
