-- P523: brand, distributor and B2B trade portal foundation
CREATE TABLE IF NOT EXISTS trade_partner_profiles (
  organisation_id UUID PRIMARY KEY REFERENCES organisations(id) ON DELETE CASCADE,
  partner_type TEXT NOT NULL CHECK (partner_type IN ('BRAND','DISTRIBUTOR')),
  public_name TEXT NOT NULL CHECK (length(trim(public_name)) BETWEEN 2 AND 160),
  gstin TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SUBMITTED','APPROVED','SUSPENDED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trade_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  buyer_organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACTIVE','REJECTED','SUSPENDED')),
  requested_by UUID REFERENCES users(id),
  decided_by UUID REFERENCES users(id),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ,
  CHECK (supplier_organisation_id <> buyer_organisation_id),
  UNIQUE (supplier_organisation_id,buyer_organisation_id)
);
CREATE INDEX IF NOT EXISTS idx_trade_relationship_buyer ON trade_relationships(buyer_organisation_id,status);
CREATE INDEX IF NOT EXISTS idx_trade_relationship_supplier ON trade_relationships(supplier_organisation_id,status);

CREATE TABLE IF NOT EXISTS trade_catalogue_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  trade_sku TEXT,
  trade_price NUMERIC(14,2) NOT NULL CHECK (trade_price >= 0),
  minimum_order_quantity NUMERIC(14,3) NOT NULL DEFAULT 1 CHECK (minimum_order_quantity > 0),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (supplier_organisation_id,product_id),
  UNIQUE (supplier_organisation_id,trade_sku)
);
CREATE INDEX IF NOT EXISTS idx_trade_catalogue_supplier_status ON trade_catalogue_items(supplier_organisation_id,status);

CREATE TABLE IF NOT EXISTS trade_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL,
  supplier_organisation_id UUID NOT NULL REFERENCES organisations(id),
  buyer_organisation_id UUID NOT NULL REFERENCES organisations(id),
  status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED','ACCEPTED','REJECTED','PROCESSING','DISPATCHED','DELIVERED','CANCELLED')),
  subtotal NUMERIC(14,2) NOT NULL CHECK (subtotal >= 0),
  notes TEXT,
  created_by UUID REFERENCES users(id),
  decided_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (buyer_organisation_id,order_number)
);
CREATE INDEX IF NOT EXISTS idx_trade_orders_supplier ON trade_orders(supplier_organisation_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trade_orders_buyer ON trade_orders(buyer_organisation_id,status,created_at DESC);

CREATE TABLE IF NOT EXISTS trade_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_order_id UUID NOT NULL REFERENCES trade_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(14,2) NOT NULL CHECK (unit_price >= 0),
  line_total NUMERIC(14,2) NOT NULL CHECK (line_total >= 0)
);
CREATE INDEX IF NOT EXISTS idx_trade_order_lines_order ON trade_order_lines(trade_order_id);

INSERT INTO role_permissions(role_code,permission_code) VALUES
 ('BRAND_ADMIN','trade:manage'),('BRAND_ADMIN','trade:read'),
 ('BRAND_ANALYST','trade:read'),
 ('DISTRIBUTOR_ADMIN','trade:manage'),('DISTRIBUTOR_ADMIN','trade:read'),
 ('RETAIL_OWNER','trade:manage'),('RETAIL_OWNER','trade:read'),
 ('RETAIL_MANAGER','trade:manage'),('RETAIL_MANAGER','trade:read'),
 ('BAR_OWNER','trade:manage'),('BAR_OWNER','trade:read'),
 ('BAR_MANAGER','trade:manage'),('BAR_MANAGER','trade:read')
ON CONFLICT DO NOTHING;
