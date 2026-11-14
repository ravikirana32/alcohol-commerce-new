CREATE TABLE IF NOT EXISTS outlet_transfers (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id),
 from_outlet_id UUID NOT NULL REFERENCES outlets(id), to_outlet_id UUID NOT NULL REFERENCES outlets(id),
 transfer_number TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','APPROVED','DISPATCHED','RECEIVED','CANCELLED')),
 created_by UUID REFERENCES users(id), approved_by UUID REFERENCES users(id), dispatched_at TIMESTAMPTZ, received_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(organisation_id,transfer_number), CHECK(from_outlet_id<>to_outlet_id)
);
CREATE TABLE IF NOT EXISTS outlet_transfer_lines (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), transfer_id UUID NOT NULL REFERENCES outlet_transfers(id) ON DELETE CASCADE,
 product_id UUID NOT NULL REFERENCES products(id), quantity NUMERIC(14,3) NOT NULL CHECK(quantity>0), received_quantity NUMERIC(14,3) NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS outlet_price_lists (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id),
 outlet_id UUID REFERENCES outlets(id), product_id UUID NOT NULL REFERENCES products(id), selling_price NUMERIC(14,2) NOT NULL CHECK(selling_price>=0),
 effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(), effective_until TIMESTAMPTZ, UNIQUE(outlet_id,product_id,effective_from)
);
CREATE TABLE IF NOT EXISTS outlet_groups (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id), name TEXT NOT NULL,
 UNIQUE(organisation_id,name)
);
CREATE TABLE IF NOT EXISTS outlet_group_members (
 group_id UUID NOT NULL REFERENCES outlet_groups(id) ON DELETE CASCADE, outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
 PRIMARY KEY(group_id,outlet_id)
);


INSERT INTO role_permissions(role_code,permission_code)
SELECT role_code,permission_code FROM (VALUES
('RETAIL_OWNER','outlet:transfer'),('RETAIL_MANAGER','outlet:transfer'),('RETAIL_OWNER','finance:manage'),('RETAIL_OWNER','finance:read'),
('RETAIL_MANAGER','finance:read'),('RETAIL_OWNER','crm:manage'),('RETAIL_OWNER','crm:read'),('RETAIL_MANAGER','crm:read'),
('BRAND_ADMIN','brand:manage'),('BRAND_ADMIN','brand:read'),('BRAND_ANALYST','brand:read'),
('DISTRIBUTOR_ADMIN','distributor:manage'),('DISTRIBUTOR_ADMIN','distributor:read'),
('RETAIL_OWNER','trade:manage'),('RETAIL_MANAGER','trade:manage'),('BAR_OWNER','trade:manage'),('SALES_REP','trade:visit'),
('PLATFORM_ADMIN','consumer:review'),('RETAIL_OWNER','consumer:manage'),
('RETAIL_OWNER','analytics:read'),('RETAIL_MANAGER','analytics:read'),('BRAND_ANALYST','analytics:read'),
('RETAIL_OWNER','sync:manage'),('RETAIL_MANAGER','sync:manage'),('PLATFORM_ADMIN','ops:manage'),('PLATFORM_ADMIN','ops:read')
) AS p(role_code,permission_code) ON CONFLICT DO NOTHING;

INSERT INTO role_permissions(role_code,permission_code)
SELECT role_code,permission_code FROM (VALUES
 ('BRAND_ADMIN','trade:manage'),('BRAND_ADMIN','trade:read'),
 ('DISTRIBUTOR_ADMIN','trade:visit'),('PLATFORM_ADMIN','distributor:manage'),
 ('PLATFORM_ADMIN','trade:manage')
) AS p(role_code,permission_code) ON CONFLICT DO NOTHING;
