-- P534: effective-dated tax rule packs, verified product profiles and approved outlet price books.
-- Statutory rates are deliberately NOT seeded. A rule pack cannot activate without sourced, reviewed components.
CREATE TABLE IF NOT EXISTS tax_rule_packs (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), jurisdiction_code CHAR(2) NOT NULL,
 pack_code TEXT NOT NULL, version_no INTEGER NOT NULL CHECK(version_no>0), title TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','PENDING_REVIEW','APPROVED','ACTIVE','REJECTED','SUPERSEDED')),
 effective_from DATE NOT NULL, effective_until DATE, source_register JSONB NOT NULL DEFAULT '[]'::jsonb,
 created_by UUID NOT NULL REFERENCES users(id), submitted_by UUID REFERENCES users(id), reviewed_by UUID REFERENCES users(id), activated_by UUID REFERENCES users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), reviewed_at TIMESTAMPTZ, activated_at TIMESTAMPTZ,
 CHECK(effective_until IS NULL OR effective_until>=effective_from), UNIQUE(jurisdiction_code,pack_code,version_no)
);
CREATE TABLE IF NOT EXISTS tax_rule_components (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), rule_pack_id UUID NOT NULL REFERENCES tax_rule_packs(id) ON DELETE CASCADE,
 component_code TEXT NOT NULL CHECK(component_code IN ('CGST','SGST','IGST','STATE_EXCISE','AED','ACD','STATE_VAT','CESS','OTHER')),
 calculation_basis TEXT NOT NULL CHECK(calculation_basis IN ('PERCENT_EXCLUSIVE','PERCENT_INCLUSIVE','PER_LITRE_PURE_ALCOHOL','PER_BULK_LITRE','FIXED_PER_UNIT','PRICE_SLAB')),
 rate NUMERIC(14,6) NOT NULL CHECK(rate>=0), slab_min NUMERIC(14,2), slab_max NUMERIC(14,2),
 source_reference TEXT NOT NULL, source_uri TEXT NOT NULL, created_by UUID NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(rule_pack_id,component_code,calculation_basis,slab_min,slab_max), CHECK(slab_max IS NULL OR slab_min IS NULL OR slab_max>slab_min)
);
CREATE TABLE IF NOT EXISTS tax_rule_pack_audit (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), rule_pack_id UUID NOT NULL REFERENCES tax_rule_packs(id), actor_user_id UUID NOT NULL REFERENCES users(id), action TEXT NOT NULL, reason TEXT NOT NULL, metadata JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS tax_product_profiles (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id), product_id UUID NOT NULL REFERENCES products(id),
 jurisdiction_code CHAR(2) NOT NULL, product_class TEXT NOT NULL CHECK(product_class IN ('SPIRIT','WINE','BEER','NON_ALCOHOLIC','FOOD','OTHER')),
 abv NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK(abv>=0 AND abv<=100), hsn_code TEXT, excise_classification TEXT,
 gst_exempt_for_alcohol BOOLEAN NOT NULL DEFAULT FALSE, status TEXT NOT NULL DEFAULT 'PENDING_REVIEW' CHECK(status IN ('PENDING_REVIEW','VERIFIED','REJECTED')),
 created_by UUID NOT NULL REFERENCES users(id), reviewed_by UUID REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), reviewed_at TIMESTAMPTZ,
 UNIQUE(organisation_id,product_id,jurisdiction_code,id)
);
CREATE INDEX IF NOT EXISTS idx_tax_profiles_product ON tax_product_profiles(organisation_id,product_id,jurisdiction_code,status);
CREATE TABLE IF NOT EXISTS outlet_tax_prices (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id), outlet_id UUID NOT NULL REFERENCES outlets(id), product_id UUID NOT NULL REFERENCES products(id),
 profile_id UUID NOT NULL REFERENCES tax_product_profiles(id), channel TEXT NOT NULL CHECK(channel IN ('RETAIL','BAR')), currency CHAR(3) NOT NULL DEFAULT 'INR',
 unit_price NUMERIC(14,2) NOT NULL CHECK(unit_price>0), mrp NUMERIC(14,2), menu_ceiling NUMERIC(14,2), effective_from TIMESTAMPTZ NOT NULL, effective_until TIMESTAMPTZ,
 status TEXT NOT NULL DEFAULT 'PENDING_REVIEW' CHECK(status IN ('PENDING_REVIEW','APPROVED','REJECTED','SUPERSEDED')),
 created_by UUID NOT NULL REFERENCES users(id), reviewed_by UUID REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), reviewed_at TIMESTAMPTZ,
 CHECK(effective_until IS NULL OR effective_until>effective_from), CHECK(mrp IS NULL OR unit_price<=mrp), CHECK(menu_ceiling IS NULL OR unit_price<=menu_ceiling)
);
CREATE INDEX IF NOT EXISTS idx_outlet_tax_prices_current ON outlet_tax_prices(organisation_id,outlet_id,product_id,channel,status,effective_from);
CREATE TABLE IF NOT EXISTS tax_calculation_snapshots (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id), outlet_id UUID REFERENCES outlets(id), product_id UUID REFERENCES products(id),
 profile_id UUID REFERENCES tax_product_profiles(id), rule_pack_id UUID REFERENCES tax_rule_packs(id), price_id UUID REFERENCES outlet_tax_prices(id),
 request_hash CHAR(64) NOT NULL, snapshot JSONB NOT NULL, snapshot_hash CHAR(64) NOT NULL, calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS tax_calculation_attempts (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id), outlet_id UUID REFERENCES outlets(id), actor_user_id UUID NOT NULL REFERENCES users(id),
 outcome TEXT NOT NULL CHECK(outcome IN ('ALLOW','DENY')), reason_code TEXT NOT NULL, request_hash CHAR(64) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE OR REPLACE FUNCTION p534_reject_tax_evidence_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'P534 tax evidence is append-only'; END $$;
DROP TRIGGER IF EXISTS tax_snapshots_immutable ON tax_calculation_snapshots;
CREATE TRIGGER tax_snapshots_immutable BEFORE UPDATE OR DELETE ON tax_calculation_snapshots FOR EACH ROW EXECUTE FUNCTION p534_reject_tax_evidence_mutation();
DROP TRIGGER IF EXISTS tax_attempts_immutable ON tax_calculation_attempts;
CREATE TRIGGER tax_attempts_immutable BEFORE UPDATE OR DELETE ON tax_calculation_attempts FOR EACH ROW EXECUTE FUNCTION p534_reject_tax_evidence_mutation();
INSERT INTO role_permissions(role_code,permission_code)
SELECT r,p FROM (VALUES ('PLATFORM_ADMIN','tax:manage-rules'),('PLATFORM_ADMIN','tax:review-rules'),('PLATFORM_ADMIN','tax:activate-rules'),('PLATFORM_ADMIN','tax:read'),('RETAIL_OWNER','tax:read'),('RETAIL_OWNER','tax:manage-products'),('RETAIL_OWNER','tax:manage-prices'),('BAR_OWNER','tax:read'),('BAR_OWNER','tax:manage-products'),('BAR_OWNER','tax:manage-prices'),('OUTLET_MANAGER','tax:read'),('OUTLET_MANAGER','tax:manage-prices')) v(r,p)
ON CONFLICT DO NOTHING;
