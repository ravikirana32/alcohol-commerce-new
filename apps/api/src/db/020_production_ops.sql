CREATE TABLE IF NOT EXISTS operational_alerts (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID REFERENCES organisations(id),
 severity TEXT NOT NULL CHECK(severity IN ('INFO','WARNING','CRITICAL')), alert_key TEXT NOT NULL,
 message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','ACKNOWLEDGED','RESOLVED')),
 created_at TIMESTAMPTZ DEFAULT NOW(), resolved_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS backup_verifications (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), environment TEXT NOT NULL, backup_reference TEXT NOT NULL,
 restore_tested BOOLEAN NOT NULL DEFAULT FALSE, verified_by TEXT, verified_at TIMESTAMPTZ, notes TEXT
);
CREATE TABLE IF NOT EXISTS release_checks (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), release_version TEXT NOT NULL, check_key TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('PENDING','PASS','FAIL','WAIVED')), evidence_uri TEXT, checked_by TEXT, checked_at TIMESTAMPTZ,
 UNIQUE(release_version,check_key)
);
