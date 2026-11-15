-- P588: idempotent audit record for item-level tab bill splits.
CREATE TABLE IF NOT EXISTS bar_ticket_split_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES outlets(id),
  source_ticket_id UUID NOT NULL REFERENCES bar_tickets(id) ON DELETE RESTRICT,
  created_ticket_id UUID NOT NULL REFERENCES bar_tickets(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL,
  request_fingerprint CHAR(64) NOT NULL CHECK (request_fingerprint ~ '^[a-f0-9]{64}$'),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organisation_id, source_ticket_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_bar_ticket_split_created_ticket
  ON bar_ticket_split_requests(created_ticket_id);
