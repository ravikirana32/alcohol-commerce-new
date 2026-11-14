-- P579: immutable regulatory report evidence and product-lot traceability.
CREATE TABLE IF NOT EXISTS p579_regulatory_report_runs (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE RESTRICT,
 outlet_id UUID REFERENCES outlets(id) ON DELETE RESTRICT,
 report_type TEXT NOT NULL CHECK (report_type IN ('EXCISE_DECISIONS','LICENCE_STATUS','DRY_DAY_ORDERS','COMPLIANCE_EXCEPTIONS')),
 period_from DATE NOT NULL, period_to DATE NOT NULL CHECK(period_to >= period_from),
 generated_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 row_count INTEGER NOT NULL CHECK(row_count >= 0), report_hash TEXT NOT NULL CHECK(length(report_hash)=64),
 report_data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_p579_report_org_period ON p579_regulatory_report_runs(organisation_id,report_type,period_from,period_to,created_at DESC);
CREATE TABLE IF NOT EXISTS p579_product_traceability_links (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE RESTRICT,
 outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT, product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
 stock_movement_id UUID NOT NULL REFERENCES stock_movements(id) ON DELETE RESTRICT,
 lot_reference TEXT NOT NULL CHECK(length(trim(lot_reference)) BETWEEN 1 AND 120), supplier_reference TEXT,
 manufacture_date DATE, expiry_date DATE, received_quantity NUMERIC(14,3) NOT NULL CHECK(received_quantity > 0),
 created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CHECK(expiry_date IS NULL OR manufacture_date IS NULL OR expiry_date >= manufacture_date),
 UNIQUE(organisation_id,stock_movement_id,lot_reference)
);
CREATE INDEX IF NOT EXISTS idx_p579_trace_product_lot ON p579_product_traceability_links(organisation_id,product_id,lot_reference);
CREATE INDEX IF NOT EXISTS idx_p579_trace_expiry ON p579_product_traceability_links(organisation_id,outlet_id,expiry_date) WHERE expiry_date IS NOT NULL;
INSERT INTO role_permissions(role_code,permission_code) VALUES
 ('PLATFORM_ADMIN','compliance:reports:read'),('RETAIL_OWNER','compliance:reports:read'),('BAR_OWNER','compliance:reports:read'),
 ('RETAIL_MANAGER','compliance:reports:read'),('BAR_MANAGER','compliance:reports:read'),('AUDITOR','compliance:reports:read'),
 ('PLATFORM_ADMIN','compliance:traceability:manage'),('RETAIL_OWNER','compliance:traceability:manage'),('RETAIL_MANAGER','compliance:traceability:manage')
ON CONFLICT DO NOTHING;

-- Evidence is append-only; corrections must be represented by a new report/link.
CREATE OR REPLACE FUNCTION p579_reject_evidence_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'P579 evidence is append-only'; END;
$$;
DROP TRIGGER IF EXISTS trg_p579_report_immutable ON p579_regulatory_report_runs;
CREATE TRIGGER trg_p579_report_immutable BEFORE UPDATE OR DELETE ON p579_regulatory_report_runs FOR EACH ROW EXECUTE FUNCTION p579_reject_evidence_mutation();
DROP TRIGGER IF EXISTS trg_p579_traceability_immutable ON p579_product_traceability_links;
CREATE TRIGGER trg_p579_traceability_immutable BEFORE UPDATE OR DELETE ON p579_product_traceability_links FOR EACH ROW EXECUTE FUNCTION p579_reject_evidence_mutation();
