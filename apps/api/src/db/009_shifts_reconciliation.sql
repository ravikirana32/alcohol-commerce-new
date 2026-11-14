CREATE TABLE IF NOT EXISTS outlet_shifts (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 outlet_id UUID NOT NULL REFERENCES outlets(id), shift_code TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','CLOSING','CLOSED','REOPENED')),
 opened_by UUID REFERENCES users(id), closed_by UUID REFERENCES users(id), opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 closed_at TIMESTAMPTZ, opening_cash NUMERIC(14,2) NOT NULL DEFAULT 0, closing_cash_declared NUMERIC(14,2),
 expected_cash NUMERIC(14,2), cash_variance NUMERIC(14,2), notes TEXT, UNIQUE(outlet_id,shift_code)
);
CREATE TABLE IF NOT EXISTS shift_tenders (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), shift_id UUID NOT NULL REFERENCES outlet_shifts(id) ON DELETE CASCADE,
 method TEXT NOT NULL, expected_amount NUMERIC(14,2) NOT NULL DEFAULT 0, declared_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
 variance NUMERIC(14,2) NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS shift_events (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), shift_id UUID NOT NULL REFERENCES outlet_shifts(id) ON DELETE CASCADE,
 event_type TEXT NOT NULL, payload JSONB NOT NULL DEFAULT '{}'::jsonb, actor_id UUID REFERENCES users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
