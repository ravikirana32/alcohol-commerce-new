-- P574: maker-checker stock variance correction workflow. No automatic stock mutation.
CREATE TABLE IF NOT EXISTS stock_variance_correction_requests (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organisation_id UUID NOT NULL REFERENCES organisations(id),
 outlet_id UUID NOT NULL REFERENCES outlets(id),
 exception_id UUID NOT NULL REFERENCES stock_reconciliation_exceptions(id),
 product_id UUID NOT NULL REFERENCES products(id),
 requested_delta NUMERIC(14,3) NOT NULL CHECK(requested_delta <> 0),
 reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 3 AND 1000),
 evidence_reference TEXT,
 status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED')),
 requested_by UUID NOT NULL REFERENCES users(id),
 approved_by UUID REFERENCES users(id),
 approved_at TIMESTAMPTZ,
 rejection_reason TEXT,
 stock_movement_id UUID REFERENCES stock_movements(id),
 idempotency_key TEXT NOT NULL CHECK(length(idempotency_key) BETWEEN 16 AND 120),
 request_fingerprint TEXT NOT NULL CHECK(request_fingerprint ~ '^[a-f0-9]{64}$'),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(organisation_id,outlet_id,idempotency_key),
 CHECK(status <> 'APPROVED' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL AND stock_movement_id IS NOT NULL)),
 CHECK(approved_by IS NULL OR approved_by <> requested_by)
);
CREATE INDEX IF NOT EXISTS idx_stock_variance_correction_queue
 ON stock_variance_correction_requests(organisation_id,outlet_id,status,created_at DESC);

CREATE OR REPLACE FUNCTION enforce_stock_variance_correction_scope() RETURNS trigger AS $$
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM stock_reconciliation_exceptions e
   WHERE e.id=NEW.exception_id AND e.organisation_id=NEW.organisation_id
     AND e.outlet_id=NEW.outlet_id AND e.product_id=NEW.product_id
 ) THEN
   RAISE EXCEPTION 'stock variance correction scope does not match source exception'
     USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_stock_variance_correction_scope ON stock_variance_correction_requests;
CREATE TRIGGER trg_stock_variance_correction_scope
 BEFORE INSERT OR UPDATE OF organisation_id,outlet_id,exception_id,product_id
 ON stock_variance_correction_requests
 FOR EACH ROW EXECUTE FUNCTION enforce_stock_variance_correction_scope();
