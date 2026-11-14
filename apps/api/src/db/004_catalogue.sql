CREATE TABLE IF NOT EXISTS product_categories (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 name TEXT NOT NULL, parent_id UUID REFERENCES product_categories(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(organisation_id,name)
);
CREATE TABLE IF NOT EXISTS products (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 category_id UUID REFERENCES product_categories(id), sku TEXT NOT NULL, barcode TEXT,
 name TEXT NOT NULL, brand TEXT, product_type TEXT NOT NULL DEFAULT 'SPIRIT',
 pack_size_ml INTEGER NOT NULL CHECK(pack_size_ml > 0), units_per_case INTEGER NOT NULL DEFAULT 1 CHECK(units_per_case > 0),
 abv NUMERIC(5,2), hsn_code TEXT, tax_code TEXT, status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','ARCHIVED')),
 metadata JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(organisation_id,sku)
);
CREATE INDEX IF NOT EXISTS idx_products_org_name ON products(organisation_id,name);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(organisation_id,barcode);
