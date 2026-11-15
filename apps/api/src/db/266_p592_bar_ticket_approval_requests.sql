-- P592: dual-control approval for bar refunds, voids, discounts, and comps.
CREATE TABLE IF NOT EXISTS bar_ticket_approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES outlets(id),
  ticket_id UUID NOT NULL REFERENCES bar_tickets(id) ON DELETE RESTRICT,
  request_type TEXT NOT NULL CHECK (request_type IN ('VOID','REFUND','DISCOUNT','COMP','TIP','SERVICE_CHARGE')),
  idempotency_key TEXT NOT NULL,
  request_fingerprint CHAR(64) NOT NULL CHECK (request_fingerprint ~ '^[a-f0-9]{64}$'),
  request_payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','EXECUTED')),
  requested_by UUID NOT NULL REFERENCES users(id),
  decided_by UUID REFERENCES users(id),
  decision_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  UNIQUE (organisation_id, ticket_id, request_type, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_bar_ticket_approval_queue
  ON bar_ticket_approval_requests(organisation_id, status, created_at);

CREATE TABLE IF NOT EXISTS bar_ticket_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES outlets(id),
  ticket_id UUID NOT NULL REFERENCES bar_tickets(id) ON DELETE RESTRICT,
  approval_request_id UUID NOT NULL UNIQUE REFERENCES bar_ticket_approval_requests(id) ON DELETE RESTRICT,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('DISCOUNT','COMP','TIP','SERVICE_CHARGE')),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 3 AND 500),
  customer_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO role_permissions(role_code, permission_code) VALUES
  ('BAR_OWNER','bar:approve'),
  ('BAR_MANAGER','bar:approve'),
  ('BAR_MANAGER','bar:refund')
ON CONFLICT DO NOTHING;
