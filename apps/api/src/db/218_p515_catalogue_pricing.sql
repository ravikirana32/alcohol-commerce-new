-- P515: catalogue integrity, variants, brand directory and auditable price history.
CREATE TABLE IF NOT EXISTS product_brands (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 120),
 description TEXT,
 status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','ARCHIVED')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE (organisation_id, name), UNIQUE (id, organisation_id)
);
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand_id UUID;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_uri TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate <= 100);
ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id);
DO $$ BEGIN ALTER TABLE product_categories ADD CONSTRAINT uq_product_categories_id_org UNIQUE(id, organisation_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE products ADD CONSTRAINT uq_products_id_org UNIQUE(id, organisation_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE product_categories ADD CONSTRAINT fk_product_categories_parent_org FOREIGN KEY(parent_id, organisation_id) REFERENCES product_categories(id, organisation_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
 ALTER TABLE products ADD CONSTRAINT fk_products_brand_org FOREIGN KEY (brand_id, organisation_id) REFERENCES product_brands(id, organisation_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
 ALTER TABLE products ADD CONSTRAINT fk_products_category_org FOREIGN KEY (category_id, organisation_id) REFERENCES product_categories(id, organisation_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS product_variants (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 product_id UUID NOT NULL, variant_code TEXT NOT NULL, name TEXT NOT NULL,
 barcode TEXT, pack_size_ml INTEGER NOT NULL CHECK (pack_size_ml > 0), units_per_case INTEGER NOT NULL DEFAULT 1 CHECK (units_per_case > 0),
 status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','ARCHIVED')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 FOREIGN KEY (product_id, organisation_id) REFERENCES products(id, organisation_id) ON DELETE CASCADE,
 UNIQUE (organisation_id, variant_code), UNIQUE (id, organisation_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_org_barcode ON products(organisation_id, barcode) WHERE barcode IS NOT NULL AND barcode <> '';
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_variants_org_barcode ON product_variants(organisation_id, barcode) WHERE barcode IS NOT NULL AND barcode <> '';
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(organisation_id, product_id, status);
CREATE INDEX IF NOT EXISTS idx_product_categories_parent ON product_categories(organisation_id, parent_id, status);
CREATE INDEX IF NOT EXISTS idx_products_org_category_status ON products(organisation_id, category_id, status);
CREATE INDEX IF NOT EXISTS idx_products_org_brand ON products(organisation_id, brand_id);
-- Existing outlet_product_prices rows already form immutable price history when superseded.
CREATE INDEX IF NOT EXISTS idx_outlet_prices_history ON outlet_product_prices(organisation_id, outlet_id, product_id, effective_from DESC);
