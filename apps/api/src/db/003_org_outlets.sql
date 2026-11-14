ALTER TABLE organisations ADD COLUMN IF NOT EXISTS name TEXT;
UPDATE organisations SET name = display_name WHERE name IS NULL;
ALTER TABLE organisations ALTER COLUMN name SET NOT NULL;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS gstin TEXT;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS organisation_profile TEXT NOT NULL DEFAULT 'RETAIL_ONLY'
  CHECK (organisation_profile IN ('RETAIL_ONLY','BAR_ONLY','HYBRID'));
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE outlets ADD COLUMN IF NOT EXISTS outlet_type TEXT NOT NULL DEFAULT 'RETAIL'
  CHECK (outlet_type IN ('RETAIL','BAR','HYBRID'));
ALTER TABLE outlet_licences ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE;
UPDATE outlet_licences ol SET organisation_id=o.organisation_id FROM outlets o
 WHERE ol.outlet_id=o.id AND ol.organisation_id IS NULL;
ALTER TABLE outlet_licences ADD COLUMN IF NOT EXISTS issuing_authority TEXT;
ALTER TABLE outlet_licences ADD COLUMN IF NOT EXISTS licence_number TEXT;
UPDATE outlet_licences SET licence_number=COALESCE(licence_number,licence_number_encrypted,'PENDING-REFERENCE') WHERE licence_number IS NULL;
ALTER TABLE outlet_licences ALTER COLUMN licence_number SET NOT NULL;
ALTER TABLE outlet_licences ADD COLUMN IF NOT EXISTS permitted_activities TEXT[] NOT NULL DEFAULT '{}';
UPDATE outlet_licences SET permitted_activities=ARRAY(SELECT jsonb_array_elements_text(permitted_capabilities))
 WHERE permitted_activities='{}' AND jsonb_typeof(permitted_capabilities)='array';
ALTER TABLE outlet_licences ADD COLUMN IF NOT EXISTS evidence_uri TEXT;
ALTER TABLE outlet_licences ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'SUBMITTED'
  CHECK (status IN ('SUBMITTED','UNDER_REVIEW','VERIFIED','REJECTED','EXPIRED','SUSPENDED'));
ALTER TABLE outlet_licences ADD COLUMN IF NOT EXISTS review_notes TEXT;
ALTER TABLE outlet_licences ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id);
ALTER TABLE outlet_licences ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_outlets_org ON outlets(organisation_id);
CREATE INDEX IF NOT EXISTS idx_licences_outlet ON outlet_licences(outlet_id);


-- Permission codes for the P04-P10 operational modules.
INSERT INTO role_permissions(role_code,permission_code)
SELECT role_code, permission_code FROM (VALUES
 ('PLATFORM_ADMIN','organisation:manage'),('PLATFORM_ADMIN','organisation:read'),('PLATFORM_ADMIN','outlet:manage'),('PLATFORM_ADMIN','outlet:read'),('PLATFORM_ADMIN','licence:manage'),('PLATFORM_ADMIN','licence:read'),('PLATFORM_ADMIN','licence:review'),
 ('RETAIL_OWNER','organisation:read'),('RETAIL_OWNER','outlet:manage'),('RETAIL_OWNER','outlet:read'),('RETAIL_OWNER','licence:manage'),('RETAIL_OWNER','licence:read'),('RETAIL_OWNER','catalogue:manage'),('RETAIL_OWNER','catalogue:read'),('RETAIL_OWNER','inventory:receive'),('RETAIL_OWNER','inventory:read'),('RETAIL_OWNER','inventory:adjust'),('RETAIL_OWNER','retail:sell'),('RETAIL_OWNER','retail:read'),('RETAIL_OWNER','peg:manage'),('RETAIL_OWNER','peg:read'),('RETAIL_OWNER','peg:sell'),('RETAIL_OWNER','bar:sell'),('RETAIL_OWNER','bar:take_payment'),('RETAIL_OWNER','shift:manage'),('RETAIL_OWNER','shift:read'),
 ('RETAIL_MANAGER','outlet:read'),('RETAIL_MANAGER','licence:read'),('RETAIL_MANAGER','catalogue:manage'),('RETAIL_MANAGER','catalogue:read'),('RETAIL_MANAGER','inventory:receive'),('RETAIL_MANAGER','inventory:read'),('RETAIL_MANAGER','inventory:adjust'),('RETAIL_MANAGER','retail:sell'),('RETAIL_MANAGER','retail:read'),('RETAIL_MANAGER','peg:manage'),('RETAIL_MANAGER','peg:read'),('RETAIL_MANAGER','peg:sell'),('RETAIL_MANAGER','bar:sell'),('RETAIL_MANAGER','bar:take_payment'),('RETAIL_MANAGER','shift:manage'),('RETAIL_MANAGER','shift:read'),
 ('CASHIER','catalogue:read'),('CASHIER','inventory:read'),('CASHIER','retail:sell'),('CASHIER','retail:read'),('CASHIER','shift:read'),
 ('BAR_OWNER','outlet:read'),('BAR_OWNER','licence:read'),('BAR_OWNER','catalogue:manage'),('BAR_OWNER','catalogue:read'),('BAR_OWNER','inventory:receive'),('BAR_OWNER','inventory:read'),('BAR_OWNER','inventory:adjust'),('BAR_OWNER','peg:manage'),('BAR_OWNER','peg:read'),('BAR_OWNER','peg:sell'),('BAR_OWNER','bar:sell'),('BAR_OWNER','bar:take_payment'),('BAR_OWNER','shift:manage'),('BAR_OWNER','shift:read'),
 ('BARTENDER','catalogue:read'),('BARTENDER','peg:read'),('BARTENDER','peg:sell'),('BARTENDER','bar:sell'),('BARTENDER','bar:take_payment'),('BARTENDER','shift:read')
) AS p(role_code,permission_code)
ON CONFLICT DO NOTHING;
