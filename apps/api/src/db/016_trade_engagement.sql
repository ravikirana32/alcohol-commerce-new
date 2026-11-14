CREATE TABLE IF NOT EXISTS trade_schemes (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), brand_org_id UUID NOT NULL REFERENCES organisations(id),
 name TEXT NOT NULL, description TEXT, starts_at TIMESTAMPTZ, ends_at TIMESTAMPTZ,
 status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','SUBMITTED','APPROVED','ACTIVE','PAUSED','CLOSED'))
);
CREATE TABLE IF NOT EXISTS trade_scheme_participants (
 scheme_id UUID NOT NULL REFERENCES trade_schemes(id) ON DELETE CASCADE, outlet_id UUID NOT NULL REFERENCES outlets(id),
 enrolled_at TIMESTAMPTZ DEFAULT NOW(), status TEXT NOT NULL DEFAULT 'ENROLLED', PRIMARY KEY(scheme_id,outlet_id)
);
CREATE TABLE IF NOT EXISTS trade_points_ledger (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), scheme_id UUID NOT NULL REFERENCES trade_schemes(id),
 outlet_id UUID NOT NULL REFERENCES outlets(id), points_delta BIGINT NOT NULL CHECK(points_delta<>0),
 reason TEXT NOT NULL, approved_by UUID REFERENCES users(id), created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS field_visits (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id),
 outlet_id UUID NOT NULL REFERENCES outlets(id), representative_id UUID REFERENCES users(id),
 visit_status TEXT NOT NULL DEFAULT 'PLANNED', notes TEXT, check_in_at TIMESTAMPTZ, check_out_at TIMESTAMPTZ,
 audit_payload JSONB NOT NULL DEFAULT '{}'
);
