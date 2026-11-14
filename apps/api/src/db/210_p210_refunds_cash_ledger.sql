-- P210: auditable refund and cash movement records. All writes are transaction-scoped by API.
CREATE TABLE IF NOT EXISTS retail_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES outlets(id),
  sale_id UUID NOT NULL REFERENCES retail_sales(id),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL CHECK (length(trim(reason)) >= 3),
  refund_method TEXT NOT NULL CHECK (refund_method IN ('CASH','UPI','CARD','WALLET','OTHER')),
  reference TEXT,
  restock BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_retail_refunds_sale ON retail_refunds(sale_id, created_at);
CREATE TABLE IF NOT EXISTS bar_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES outlets(id),
  ticket_id UUID NOT NULL REFERENCES bar_tickets(id),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL CHECK (length(trim(reason)) >= 3),
  refund_method TEXT NOT NULL CHECK (refund_method IN ('CASH','UPI','CARD','WALLET','OTHER')),
  reference TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bar_refunds_ticket ON bar_refunds(ticket_id, created_at);
CREATE TABLE IF NOT EXISTS shift_cash_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES outlets(id),
  shift_id UUID NOT NULL REFERENCES outlet_shifts(id),
  direction TEXT NOT NULL CHECK (direction IN ('IN','OUT')),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL CHECK (length(trim(reason)) >= 3),
  reference TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_shift_cash_movements_shift ON shift_cash_movements(shift_id, created_at);

-- Refund actions are manager/owner controlled; cashier roles do not receive refund permission by default.
INSERT INTO role_permissions(role_code,permission_code)
SELECT role_code,permission_code FROM (VALUES
 ('RETAIL_OWNER','retail:refund'),('RETAIL_MANAGER','retail:refund'),('BAR_OWNER','retail:refund'),
 ('RETAIL_OWNER','bar:refund'),('RETAIL_MANAGER','bar:refund'),('BAR_OWNER','bar:refund')
) AS p(role_code,permission_code) ON CONFLICT DO NOTHING;

INSERT INTO platform_phase_delivery_register(phase_code,phase_title,delivery_scope,delivery_state,evidence_reference) VALUES
 ('P206','Runtime and build stabilisation','Node/npm engine policy, syntax verification and operational indexes','developer-preview','docs/P206-RELEASE-NOTES.md'),
 ('P207','Migration integrity tooling','Migration ordering and checksum registry foundation','developer-preview','docs/P207-RELEASE-NOTES.md'),
 ('P208','Retail checkout concurrency','Lock stock balances and reserve repeated product lines','developer-preview','docs/P208-RELEASE-NOTES.md'),
 ('P209','Bar checkout concurrency','Reserve repeated stock lines and verify peg row locking','developer-preview','docs/P209-RELEASE-NOTES.md'),
 ('P210','Refund and cash ledger','Retail/bar refund ledger and shift cash movement reconciliation','developer-preview','docs/P210-RELEASE-NOTES.md')
ON CONFLICT(phase_code) DO UPDATE SET phase_title=EXCLUDED.phase_title,delivery_scope=EXCLUDED.delivery_scope,delivery_state=EXCLUDED.delivery_state,evidence_reference=EXCLUDED.evidence_reference,updated_at=NOW();
