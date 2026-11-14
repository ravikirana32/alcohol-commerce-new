-- P570: immutable stock reconciliation runs and investigation exceptions.
CREATE TABLE IF NOT EXISTS stock_reconciliation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  outlet_id UUID NOT NULL REFERENCES outlets(id),
  status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED','COMPLETED_WITH_EXCEPTIONS')),
  started_by UUID REFERENCES users(id),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  product_count INTEGER NOT NULL DEFAULT 0 CHECK (product_count >= 0),
  exception_count INTEGER NOT NULL DEFAULT 0 CHECK (exception_count >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stock_reconciliation_runs_scope
  ON stock_reconciliation_runs(organisation_id,outlet_id,completed_at DESC);
CREATE TABLE IF NOT EXISTS stock_reconciliation_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  outlet_id UUID NOT NULL REFERENCES outlets(id),
  run_id UUID NOT NULL REFERENCES stock_reconciliation_runs(id),
  product_id UUID REFERENCES products(id),
  exception_type TEXT NOT NULL CHECK (exception_type IN ('BALANCE_LEDGER_VARIANCE','UNCLASSIFIED_ADJUSTMENT','MISSING_BALANCE_ROW','NEGATIVE_BALANCE')),
  severity TEXT NOT NULL CHECK (severity IN ('INFO','WARNING','CRITICAL')),
  ledger_quantity NUMERIC(14,3),
  balance_quantity NUMERIC(14,3),
  variance_quantity NUMERIC(14,3),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','INVESTIGATING','RESOLVED','ACCEPTED')),
  resolution_notes TEXT,
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stock_reconciliation_exceptions_scope
  ON stock_reconciliation_exceptions(organisation_id,outlet_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_reconciliation_exceptions_run
  ON stock_reconciliation_exceptions(run_id);
