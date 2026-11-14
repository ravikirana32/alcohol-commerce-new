-- P30: Trade partner mobile app
-- Review FK assumptions and execute in staging before production.
CREATE TABLE IF NOT EXISTS field_tasks (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id), assigned_user_id UUID REFERENCES users(id), outlet_id UUID REFERENCES outlets(id), task_type TEXT NOT NULL, due_at TIMESTAMPTZ, status TEXT NOT NULL DEFAULT 'open');
CREATE TABLE IF NOT EXISTS field_visit_evidence (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), visit_id UUID NOT NULL, evidence_type TEXT NOT NULL, object_uri TEXT, captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS mobile_push_devices (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id), platform TEXT NOT NULL, push_token_hash TEXT NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE);
