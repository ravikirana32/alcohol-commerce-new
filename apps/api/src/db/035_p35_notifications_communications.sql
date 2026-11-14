-- P35: Notifications & communications
-- Review FK assumptions and execute in staging before production.
CREATE TABLE IF NOT EXISTS notification_templates (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID REFERENCES organisations(id), channel TEXT NOT NULL, template_key TEXT NOT NULL, body TEXT NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE);
CREATE TABLE IF NOT EXISTS notification_preferences (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id), channel TEXT NOT NULL, enabled BOOLEAN NOT NULL DEFAULT TRUE, UNIQUE(user_id, channel));
CREATE TABLE IF NOT EXISTS notification_deliveries (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID REFERENCES organisations(id), channel TEXT NOT NULL, destination_hash TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'queued', provider_ref TEXT, attempted_at TIMESTAMPTZ);
