-- P533: effective-dated, jurisdiction-specific excise policy packs and fail-closed sale evaluation.
CREATE TABLE IF NOT EXISTS excise_rule_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_code CHAR(2) NOT NULL,
  pack_code TEXT NOT NULL UNIQUE,
  version_no INTEGER NOT NULL CHECK (version_no > 0),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PENDING_REVIEW','REJECTED','APPROVED','ACTIVE','RETIRED')),
  effective_from DATE NOT NULL,
  effective_until DATE,
  source_register JSONB NOT NULL DEFAULT '[]'::jsonb,
  submitted_by UUID REFERENCES users(id),
  submitted_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  activated_by UUID REFERENCES users(id),
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (effective_until IS NULL OR effective_until >= effective_from),
  CHECK (status <> 'ACTIVE' OR (reviewed_by IS NOT NULL AND activated_by IS NOT NULL AND reviewed_by <> activated_by))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_excise_active_pack_per_jurisdiction
  ON excise_rule_packs(jurisdiction_code) WHERE status='ACTIVE';

CREATE TABLE IF NOT EXISTS excise_rule_pack_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_pack_id UUID NOT NULL REFERENCES excise_rule_packs(id) ON DELETE RESTRICT,
  rule_key TEXT NOT NULL,
  rule_value JSONB NOT NULL,
  source_reference TEXT NOT NULL,
  source_uri TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(rule_pack_id,rule_key)
);

CREATE TABLE IF NOT EXISTS outlet_licence_excise_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  licence_id UUID NOT NULL REFERENCES outlet_licences(id) ON DELETE RESTRICT,
  weekly_hours JSONB NOT NULL,
  local_timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata' CHECK (local_timezone='Asia/Kolkata'),
  status TEXT NOT NULL DEFAULT 'PENDING_REVIEW' CHECK (status IN ('PENDING_REVIEW','VERIFIED','REJECTED','SUPERSEDED')),
  submitted_by UUID REFERENCES users(id),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (reviewed_by IS NULL OR submitted_by IS NULL OR reviewed_by <> submitted_by)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_outlet_licence_excise_conditions_verified
  ON outlet_licence_excise_conditions(licence_id) WHERE status='VERIFIED';

CREATE TABLE IF NOT EXISTS excise_dry_day_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_code CHAR(2) NOT NULL,
  dry_day_date DATE NOT NULL,
  district TEXT,
  order_reference TEXT NOT NULL,
  source_uri TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 8 AND 1000),
  status TEXT NOT NULL DEFAULT 'PENDING_REVIEW' CHECK (status IN ('PENDING_REVIEW','ACTIVE','REJECTED','CANCELLED')),
  submitted_by UUID REFERENCES users(id),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (reviewed_by IS NULL OR submitted_by IS NULL OR reviewed_by <> submitted_by),
  UNIQUE(jurisdiction_code,dry_day_date,district,order_reference)
);
CREATE INDEX IF NOT EXISTS idx_excise_dry_days_active ON excise_dry_day_orders(jurisdiction_code,dry_day_date,district) WHERE status='ACTIVE';

CREATE TABLE IF NOT EXISTS excise_compliance_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
  licence_id UUID REFERENCES outlet_licences(id) ON DELETE RESTRICT,
  rule_pack_id UUID REFERENCES excise_rule_packs(id) ON DELETE RESTRICT,
  channel TEXT NOT NULL CHECK (channel IN ('RETAIL','BAR')),
  outcome TEXT NOT NULL CHECK (outcome IN ('ALLOW','DENY')),
  reason_codes TEXT[] NOT NULL DEFAULT '{}',
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  transaction_occurred_at TIMESTAMPTZ NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('ONLINE_RETAIL','ONLINE_BAR','OFFLINE_RETAIL','OFFLINE_BAR','PREVIEW')),
  source_reference TEXT,
  request_hash TEXT NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  sale_id UUID REFERENCES retail_sales(id) ON DELETE RESTRICT,
  bar_ticket_id UUID REFERENCES bar_tickets(id) ON DELETE RESTRICT,
  actor_user_id UUID REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_excise_decisions_org_time ON excise_compliance_decisions(organisation_id,evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_excise_decisions_outlet_time ON excise_compliance_decisions(outlet_id,evaluated_at DESC);
ALTER TABLE retail_sales ADD COLUMN IF NOT EXISTS excise_decision_id UUID REFERENCES excise_compliance_decisions(id) ON DELETE RESTRICT;
ALTER TABLE bar_tickets ADD COLUMN IF NOT EXISTS excise_decision_id UUID REFERENCES excise_compliance_decisions(id) ON DELETE RESTRICT;

INSERT INTO excise_rule_packs(jurisdiction_code,pack_code,version_no,title,status,effective_from,source_register)
VALUES ('KA','KA-BASE-2025-12',1,'Karnataka base excise controls — legal review required','DRAFT','2025-12-19',
 '[{"reference":"Government of Karnataka Gazette No. 822, FD 52 EFL 2025, 19-12-2025","uri":"https://stateexcise.karnataka.gov.in/uploads/media_to_upload1766151388.pdf"},{"reference":"Karnataka Excise (General Conditions of Licences) Rules, 1967, Rule 10(1)(e), Rule 10-A and Rule 10-B; Government of Karnataka Legislature reference copy","uri":"https://kla.kar.nic.in/council/Replies/unstarred/21082025/usq1159%2821082025%29.pdf"}]'::jsonb)
ON CONFLICT(pack_code) DO NOTHING;
INSERT INTO excise_rule_pack_rules(rule_pack_id,rule_key,rule_value,source_reference,source_uri)
SELECT p.id,r.rule_key,r.rule_value::jsonb,r.source_reference,r.source_uri
FROM excise_rule_packs p CROSS JOIN (VALUES
 ('MINIMUM_CUSTOMER_AGE','{"years":21}'::text,'General Conditions of Licences Rules, 1967 Rule 10(1)(e)','https://kla.kar.nic.in/council/Replies/unstarred/21082025/usq1159%2821082025%29.pdf'),
 ('REFUSE_IF_INTOXICATED','{"enabled":true}'::text,'General Conditions of Licences Rules, 1967 Rule 10(1)(b)','https://kla.kar.nic.in/council/Replies/unstarred/21082025/usq1159%2821082025%29.pdf'),
 ('REFUSE_RESTRICTED_CUSTOMERS','{"enabled":true,"categories":["INSANE_PERSON","PUBLIC_DISTURBANCE_RISK","RESTRICTED_OFFICIAL_ON_DUTY"]}'::text,'General Conditions of Licences Rules, 1967 Rule 10(1)(a),(c),(d)','https://kla.kar.nic.in/council/Replies/unstarred/21082025/usq1159%2821082025%29.pdf'),
 ('OFFSHOP_NO_ON_PREMISES_CONSUMPTION','{"licenceClasses":["CL2","CL2A"],"enabled":true}'::text,'Government of Karnataka Gazette No. 822, FD 52 EFL 2025, licence descriptions for CL(2-A)','https://stateexcise.karnataka.gov.in/uploads/media_to_upload1766151388.pdf'),
 ('BAR_MEALS_OR_EATABLES_REQUIRED','{"licenceClasses":["CL9","CL9A"],"enabled":true}'::text,'Government of Karnataka Gazette No. 822, FD 52 EFL 2025, licence descriptions for CL(9-A)','https://stateexcise.karnataka.gov.in/uploads/media_to_upload1766151388.pdf'),
 ('GANDHI_JAYANTI_DRY_DAY','{"month":10,"day":2,"enabled":true}'::text,'General Conditions of Licences Rules, 1967 Rule 10-A','https://kla.kar.nic.in/council/Replies/unstarred/21082025/usq1159%2821082025%29.pdf'),
 ('LICENSE_HOURS_REQUIRED','{"enabled":true,"timezone":"Asia/Kolkata"}'::text,'General Conditions of Licences Rules, 1967 Rule 4 and individual licence conditions','https://kla.kar.nic.in/council/Replies/unstarred/21082025/usq1159%2821082025%29.pdf')
) AS r(rule_key,rule_value,source_reference,source_uri)
WHERE p.pack_code='KA-BASE-2025-12'
ON CONFLICT(rule_pack_id,rule_key) DO NOTHING;

INSERT INTO role_permissions(role_code,permission_code) VALUES
 ('PLATFORM_ADMIN','excise:read'),('RETAIL_OWNER','excise:read'),('RETAIL_MANAGER','excise:read'),('BAR_OWNER','excise:read'),('BAR_MANAGER','excise:read'),
 ('PLATFORM_ADMIN','excise:manage-rules'),('PLATFORM_ADMIN','excise:review-rules'),('PLATFORM_ADMIN','excise:activate-rules'),
 ('PLATFORM_ADMIN','excise:manage-conditions'),('RETAIL_OWNER','excise:manage-conditions'),('BAR_OWNER','excise:manage-conditions'),
 ('PLATFORM_ADMIN','excise:review-conditions'),('PLATFORM_ADMIN','excise:manage-dry-days'),('PLATFORM_ADMIN','excise:review-dry-days'),
 ('RETAIL_OWNER','excise:evaluate'),('RETAIL_MANAGER','excise:evaluate'),('BAR_OWNER','excise:evaluate'),('BAR_MANAGER','excise:evaluate'),('CASHIER','excise:evaluate'),('BARTENDER','excise:evaluate')
ON CONFLICT DO NOTHING;

COMMENT ON TABLE excise_rule_packs IS 'P533 jurisdictional legal rules. The seeded Karnataka pack is DRAFT and must not be used until independent legal review and activation.';
COMMENT ON TABLE excise_compliance_decisions IS 'Immutable decision evidence for each evaluated alcohol sale; DENY decisions are retained.';

CREATE TABLE IF NOT EXISTS excise_rule_pack_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_pack_id UUID NOT NULL REFERENCES excise_rule_packs(id) ON DELETE RESTRICT,
  actor_user_id UUID REFERENCES users(id),
  action TEXT NOT NULL CHECK (action IN ('CREATED','RULE_UPSERT','SUBMITTED','REVIEWED','ACTIVATED')),
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 3 AND 2000),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_excise_rule_pack_audit_pack ON excise_rule_pack_audit(rule_pack_id,created_at);

CREATE TABLE IF NOT EXISTS excise_dry_day_order_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dry_day_order_id UUID NOT NULL REFERENCES excise_dry_day_orders(id) ON DELETE RESTRICT,
  actor_user_id UUID REFERENCES users(id),
  action TEXT NOT NULL CHECK (action IN ('SUBMITTED','APPROVED','REJECTED')),
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 3 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_excise_dry_day_audit_order ON excise_dry_day_order_audit(dry_day_order_id,created_at);

CREATE OR REPLACE FUNCTION reject_excise_audit_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Excise audit and compliance decision records are append-only';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_excise_rule_pack_audit_immutable ON excise_rule_pack_audit;
CREATE TRIGGER trg_excise_rule_pack_audit_immutable BEFORE UPDATE OR DELETE ON excise_rule_pack_audit
  FOR EACH ROW EXECUTE FUNCTION reject_excise_audit_mutation();
DROP TRIGGER IF EXISTS trg_excise_dry_day_audit_immutable ON excise_dry_day_order_audit;
CREATE TRIGGER trg_excise_dry_day_audit_immutable BEFORE UPDATE OR DELETE ON excise_dry_day_order_audit
  FOR EACH ROW EXECUTE FUNCTION reject_excise_audit_mutation();
DROP TRIGGER IF EXISTS trg_excise_compliance_decisions_immutable ON excise_compliance_decisions;
CREATE TRIGGER trg_excise_compliance_decisions_immutable BEFORE UPDATE OR DELETE ON excise_compliance_decisions
  FOR EACH ROW EXECUTE FUNCTION reject_excise_audit_mutation();

-- Reserved for P538 hardware-backed clock attestation. No client API can mark a record VERIFIED.
ALTER TABLE offline_sync_events ADD CONSTRAINT uq_offline_sync_event_org_device UNIQUE(id,organisation_id,device_id);
CREATE TABLE IF NOT EXISTS offline_device_time_attestations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES offline_sync_devices(id) ON DELETE RESTRICT,
  event_row_id UUID NOT NULL UNIQUE,
  occurred_at TIMESTAMPTZ NOT NULL,
  verification_method TEXT NOT NULL CHECK (verification_method IN ('APPLE_SECURE_ENCLAVE','ANDROID_KEY_ATTESTATION','HARDWARE_SECURE_CLOCK')),
  signature_hash TEXT NOT NULL CHECK (signature_hash ~ '^[a-f0-9]{64}$'),
  verification_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (verification_status IN ('PENDING','VERIFIED','REJECTED')),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (verification_status <> 'VERIFIED' OR verified_at IS NOT NULL),
  FOREIGN KEY(event_row_id,organisation_id,device_id) REFERENCES offline_sync_events(id,organisation_id,device_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_offline_device_time_attestation_event ON offline_device_time_attestations(organisation_id,event_row_id,verification_status);
COMMENT ON TABLE offline_device_time_attestations IS 'P533 fail-closed gate reserved for P538. Only a server-side cryptographic verifier may create VERIFIED evidence; no client-facing write route exists.';
