-- P510: auditable goods receipt and PO/GRN/invoice matching foundation.
CREATE TABLE IF NOT EXISTS goods_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES outlets(id),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id),
  receipt_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','POSTED','VOID')),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  received_by UUID REFERENCES users(id),
  posted_at TIMESTAMPTZ,
  posted_by UUID REFERENCES users(id),
  notes TEXT,
  UNIQUE (organisation_id, receipt_number)
);
ALTER TABLE goods_receipts
  ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS receipt_number TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','POSTED','VOID')),
  ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS posted_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS notes TEXT;
UPDATE goods_receipts AS gr
SET organisation_id = po.organisation_id
FROM purchase_orders AS po
WHERE gr.organisation_id IS NULL
  AND gr.purchase_order_id = po.id;
UPDATE goods_receipts
SET receipt_number = 'LEGACY-' || id::text
WHERE receipt_number IS NULL;
ALTER TABLE goods_receipts
  ALTER COLUMN organisation_id SET NOT NULL,
  ALTER COLUMN receipt_number SET NOT NULL,
  ALTER COLUMN purchase_order_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_goods_receipts_org_number
  ON goods_receipts(organisation_id, receipt_number);

CREATE TABLE IF NOT EXISTS goods_receipt_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goods_receipt_id UUID NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
  purchase_order_line_id UUID NOT NULL REFERENCES purchase_order_lines(id),
  product_id UUID NOT NULL REFERENCES products(id),
  received_units NUMERIC(14,3) NOT NULL CHECK (received_units > 0),
  accepted_units NUMERIC(14,3) NOT NULL CHECK (accepted_units >= 0 AND accepted_units <= received_units),
  rejected_units NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (rejected_units >= 0),
  unit_cost NUMERIC(14,2) NOT NULL CHECK (unit_cost >= 0),
  CHECK (accepted_units + rejected_units = received_units)
);
CREATE TABLE IF NOT EXISTS supplier_invoice_match_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  supplier_invoice_id UUID NOT NULL REFERENCES supplier_invoices(id),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id),
  goods_receipt_id UUID REFERENCES goods_receipts(id),
  match_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (match_status IN ('PENDING','MATCHED','VARIANCE','REJECTED')),
  quantity_variance NUMERIC(14,3) NOT NULL DEFAULT 0,
  value_variance NUMERIC(14,2) NOT NULL DEFAULT 0,
  tolerance_percent NUMERIC(7,3) NOT NULL DEFAULT 0 CHECK (tolerance_percent >= 0),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_goods_receipts_po ON goods_receipts(purchase_order_id, status);
CREATE INDEX IF NOT EXISTS idx_goods_receipt_lines_po_line ON goods_receipt_lines(purchase_order_line_id);
CREATE INDEX IF NOT EXISTS idx_invoice_match_org_status ON supplier_invoice_match_runs(organisation_id, match_status);
