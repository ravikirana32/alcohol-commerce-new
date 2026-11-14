-- P519: supplier lifecycle, controlled PO approvals and auditable receipt posting.
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS gstin TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS payment_terms_days INTEGER NOT NULL DEFAULT 0 CHECK(payment_terms_days BETWEEN 0 AND 365);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE TABLE IF NOT EXISTS purchase_order_approvals (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 purchase_order_id UUID NOT NULL UNIQUE REFERENCES purchase_orders(id) ON DELETE CASCADE,
 status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED')),
 requested_by UUID REFERENCES users(id), requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 reviewed_by UUID REFERENCES users(id), reviewed_at TIMESTAMPTZ, review_notes TEXT
);
CREATE TABLE IF NOT EXISTS procurement_audit_events (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 actor_user_id UUID REFERENCES users(id), entity_type TEXT NOT NULL, entity_id UUID NOT NULL,
 event_type TEXT NOT NULL, details JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_procurement_audit_entity ON procurement_audit_events(organisation_id,entity_type,entity_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_po_approval_org_status ON purchase_order_approvals(organisation_id,status,requested_at DESC);

INSERT INTO role_permissions(role_code,permission_code) VALUES
 ('RETAIL_OWNER','procurement:read'),('RETAIL_OWNER','procurement:manage'),('RETAIL_OWNER','procurement:approve'),
 ('RETAIL_MANAGER','procurement:read'),('RETAIL_MANAGER','procurement:manage'),
 ('BAR_OWNER','procurement:read'),('BAR_OWNER','procurement:manage'),('BAR_OWNER','procurement:approve'),
 ('BAR_MANAGER','procurement:read'),('BAR_MANAGER','procurement:manage')
ON CONFLICT DO NOTHING;
