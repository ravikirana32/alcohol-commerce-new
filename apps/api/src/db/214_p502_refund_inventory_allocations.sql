-- P502: line-level physical return ledgers. Rows are immutable evidence of inventory restored.
CREATE TABLE IF NOT EXISTS retail_refund_restock_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_id UUID NOT NULL REFERENCES retail_refunds(id) ON DELETE RESTRICT,
  sale_line_id UUID NOT NULL REFERENCES retail_sale_lines(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity NUMERIC(14,3) NOT NULL CHECK(quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_retail_refund_restock_sale_line ON retail_refund_restock_lines(sale_line_id);
CREATE TABLE IF NOT EXISTS bar_refund_peg_restorations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_id UUID NOT NULL REFERENCES bar_refunds(id) ON DELETE RESTRICT,
  ticket_line_id UUID NOT NULL REFERENCES bar_ticket_lines(id) ON DELETE RESTRICT,
  open_bottle_id UUID NOT NULL REFERENCES open_bottles(id) ON DELETE RESTRICT,
  volume_ml INTEGER NOT NULL CHECK(volume_ml > 0),
  disposition TEXT NOT NULL DEFAULT 'QUARANTINE_PENDING' CHECK(disposition IN ('QUARANTINE_PENDING','DISPOSED','RELEASED_BY_COMPLIANCE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bar_refund_peg_line ON bar_refund_peg_restorations(ticket_line_id);
INSERT INTO platform_phase_delivery_register(phase_code,phase_title,delivery_scope,delivery_state,evidence_reference)
VALUES ('P502','Refund inventory allocation integrity','SKU-level retail restock and auditable bar peg-volume restoration','developer-preview','doc-new/P502-IMPLEMENTATION.md')
ON CONFLICT(phase_code) DO UPDATE SET phase_title=EXCLUDED.phase_title,delivery_scope=EXCLUDED.delivery_scope,delivery_state=EXCLUDED.delivery_state,evidence_reference=EXCLUDED.evidence_reference,updated_at=NOW();
